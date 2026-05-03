/**
 * Repository Adapter
 *
 * Provides read-only access to GitHub Cloud and Bitbucket Cloud repositories
 * for component indexing. Enforces a ≤ 20 GB repository size guard.
 *
 * Auth: personal-access token or OAuth app token (read scope only).
 * Retry: ×3 with exponential back-off via withRetry().
 * Traces: every call emits a structured AdapterTrace.
 */

import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { AdapterTrace } from "../types/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_REPO_SIZE_GB = 20;
const MAX_REPO_SIZE_KB = MAX_REPO_SIZE_GB * 1024 * 1024; // GitHub reports in KB

/** Maximum decoded file size for getDecodedFileContent (100 KB) */
const MAX_FILE_CONTENT_BYTES = 100 * 1024;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class FileTooLargeError extends Error {
  constructor(path: string, sizeBytes: number) {
    super(`File "${path}" is ${(sizeBytes / 1024).toFixed(1)} KB — exceeds the 100 KB limit.`);
    this.name = "FileTooLargeError";
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type RepoProvider = "github" | "bitbucket";

export interface RepoAdapterConfig {
  provider: RepoProvider;
  /** Base API URL — defaults per provider if omitted */
  baseUrl?: string;
  /** OAuth / PAT token (read scope) */
  accessToken: string;
  /** Base delay for retry back-off in ms (default 200; set 0 in tests) */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Raw response shapes (minimal)
// ---------------------------------------------------------------------------

export interface RawRepoMeta {
  name: string;
  full_name: string;
  /** Size in KB (GitHub) or MB (Bitbucket — normalised internally) */
  size: number;
  default_branch: string;
  private: boolean;
}

export interface RawTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export interface RawFileContent {
  path: string;
  content: string; // base64 encoded
  encoding: "base64";
}

// ---------------------------------------------------------------------------
// Normalised shapes
// ---------------------------------------------------------------------------

export interface RepoMeta {
  name: string;
  fullName: string;
  sizeKb: number;
  defaultBranch: string;
  isPrivate: boolean;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class RepoAdapter {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly retryDelayMs: number;
  readonly provider: RepoProvider;

  constructor(config: RepoAdapterConfig) {
    this.provider = config.provider;
    this.retryDelayMs = config.retryDelayMs ?? 200;
    this.headers = {
      Authorization: `Bearer ${config.accessToken}`,
      Accept:
        config.provider === "github"
          ? "application/vnd.github+json"
          : "application/json",
      "Content-Type": "application/json",
    };

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, "");
    } else if (config.provider === "github") {
      this.baseUrl = "https://api.github.com";
    } else {
      this.baseUrl = "https://api.bitbucket.org/2.0";
    }
  }

  // -------------------------------------------------------------------------
  // getRepoMeta — also enforces the ≤ 20 GB guard
  // -------------------------------------------------------------------------

  async getRepoMeta(
    owner: string,
    repo: string
  ): Promise<{ meta: RepoMeta; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const raw = await withRetry(
        async () => {
          retryCount++;
          const url =
            this.provider === "github"
              ? `${this.baseUrl}/repos/${owner}/${repo}`
              : `${this.baseUrl}/repositories/${owner}/${repo}`;
          const res = await fetch(url, { headers: this.headers });
          statusCode = res.status;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as RawRepoMeta;
        },
        { baseDelayMs: this.retryDelayMs }
      );
      retryCount = Math.max(0, retryCount - 1);

      // Normalise size to KB (Bitbucket reports in MB)
      const sizeKb =
        this.provider === "bitbucket" ? raw.size * 1024 : raw.size;

      if (sizeKb > MAX_REPO_SIZE_KB) {
        throw new Error(
          `RepoAdapter: repository "${owner}/${repo}" is ${(sizeKb / 1024 / 1024).toFixed(1)} GB, ` +
            `which exceeds the ${MAX_REPO_SIZE_GB} GB limit.`
        );
      }

      const meta: RepoMeta = {
        name: raw.name,
        fullName: raw.full_name,
        sizeKb,
        defaultBranch: raw.default_branch,
        isPrivate: raw.private,
      };

      const trace = this._trace("getRepoMeta", statusCode, Date.now() - start, retryCount);
      return { meta, trace };
    } catch (err) {
      const trace = this._trace("getRepoMeta", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RepoAdapter.getRepoMeta failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getTree — list all paths in the repo (recursive)
  // -------------------------------------------------------------------------

  async getTree(
    owner: string,
    repo: string,
    branch: string
  ): Promise<{ entries: RawTreeEntry[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const entries = await withRetry(
        async () => {
          retryCount++;
          let url: string;
          if (this.provider === "github") {
            url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
          } else {
            url = `${this.baseUrl}/repositories/${owner}/${repo}/src/${branch}/?pagelen=100&recursive=true`;
          }
          const res = await fetch(url, { headers: this.headers });
          statusCode = res.status;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { tree?: RawTreeEntry[]; values?: RawTreeEntry[] };
          return data.tree ?? data.values ?? [];
        },
        { baseDelayMs: this.retryDelayMs }
      );
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getTree", statusCode, Date.now() - start, retryCount);
      return { entries, trace };
    } catch (err) {
      const trace = this._trace("getTree", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RepoAdapter.getTree failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getFileContent — fetch a single file by path
  // -------------------------------------------------------------------------

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch: string
  ): Promise<{ file: RawFileContent; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const file = await withRetry(
        async () => {
          retryCount++;
          const url =
            this.provider === "github"
              ? `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
              : `${this.baseUrl}/repositories/${owner}/${repo}/src/${branch}/${path}`;
          const res = await fetch(url, { headers: this.headers });
          statusCode = res.status;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as RawFileContent;
        },
        { baseDelayMs: this.retryDelayMs }
      );
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getFileContent", statusCode, Date.now() - start, retryCount);
      return { file, trace };
    } catch (err) {
      const trace = this._trace("getFileContent", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RepoAdapter.getFileContent failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getDecodedFileContent — fetch + base64-decode a file; enforces 100 KB guard
  // -------------------------------------------------------------------------

  async getDecodedFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; trace: AdapterTrace }> {
    const branch = ref ?? "HEAD";
    const { file, trace } = await this.getFileContent(owner, repo, path, branch);
    const decoded = Buffer.from(file.content, "base64").toString("utf-8");
    const sizeBytes = Buffer.byteLength(decoded, "utf-8");
    if (sizeBytes > MAX_FILE_CONTENT_BYTES) {
      throw new FileTooLargeError(path, sizeBytes);
    }
    return { content: decoded, trace };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private _trace(
    operation: string,
    statusCode: number | undefined,
    latencyMs: number,
    retryCount: number,
    error?: string
  ): AdapterTrace {
    const trace: AdapterTrace = {
      adapter: "repo-adapter" as AdapterTrace["adapter"],
      operation,
      statusCode,
      latencyMs,
      retryCount,
      error,
    };
    logger.adapterCall({ adapter: "repo-adapter" as never, operation, statusCode, latencyMs, retryCount, error });
    return trace;
  }
}
