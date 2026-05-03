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
    constructor(path, sizeBytes) {
        super(`File "${path}" is ${(sizeBytes / 1024).toFixed(1)} KB — exceeds the 100 KB limit.`);
        this.name = "FileTooLargeError";
    }
}
// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export class RepoAdapter {
    baseUrl;
    headers;
    retryDelayMs;
    provider;
    constructor(config) {
        this.provider = config.provider;
        this.retryDelayMs = config.retryDelayMs ?? 200;
        this.headers = {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: config.provider === "github"
                ? "application/vnd.github+json"
                : "application/json",
            "Content-Type": "application/json",
        };
        if (config.baseUrl) {
            this.baseUrl = config.baseUrl.replace(/\/$/, "");
        }
        else if (config.provider === "github") {
            this.baseUrl = "https://api.github.com";
        }
        else {
            this.baseUrl = "https://api.bitbucket.org/2.0";
        }
    }
    // -------------------------------------------------------------------------
    // getRepoMeta — also enforces the ≤ 20 GB guard
    // -------------------------------------------------------------------------
    async getRepoMeta(owner, repo) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const raw = await withRetry(async () => {
                retryCount++;
                const url = this.provider === "github"
                    ? `${this.baseUrl}/repos/${owner}/${repo}`
                    : `${this.baseUrl}/repositories/${owner}/${repo}`;
                const res = await fetch(url, { headers: this.headers });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                return (await res.json());
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1);
            // Normalise size to KB (Bitbucket reports in MB)
            const sizeKb = this.provider === "bitbucket" ? raw.size * 1024 : raw.size;
            if (sizeKb > MAX_REPO_SIZE_KB) {
                throw new Error(`RepoAdapter: repository "${owner}/${repo}" is ${(sizeKb / 1024 / 1024).toFixed(1)} GB, ` +
                    `which exceeds the ${MAX_REPO_SIZE_GB} GB limit.`);
            }
            const meta = {
                name: raw.name,
                fullName: raw.full_name,
                sizeKb,
                defaultBranch: raw.default_branch,
                isPrivate: raw.private,
            };
            const trace = this._trace("getRepoMeta", statusCode, Date.now() - start, retryCount);
            return { meta, trace };
        }
        catch (err) {
            const trace = this._trace("getRepoMeta", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RepoAdapter.getRepoMeta failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // getTree — list all paths in the repo (recursive)
    // -------------------------------------------------------------------------
    async getTree(owner, repo, branch) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const entries = await withRetry(async () => {
                retryCount++;
                let url;
                if (this.provider === "github") {
                    url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
                }
                else {
                    url = `${this.baseUrl}/repositories/${owner}/${repo}/src/${branch}/?pagelen=100&recursive=true`;
                }
                const res = await fetch(url, { headers: this.headers });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const data = (await res.json());
                return data.tree ?? data.values ?? [];
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1);
            const trace = this._trace("getTree", statusCode, Date.now() - start, retryCount);
            return { entries, trace };
        }
        catch (err) {
            const trace = this._trace("getTree", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RepoAdapter.getTree failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // getFileContent — fetch a single file by path
    // -------------------------------------------------------------------------
    async getFileContent(owner, repo, path, branch) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const file = await withRetry(async () => {
                retryCount++;
                const url = this.provider === "github"
                    ? `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
                    : `${this.baseUrl}/repositories/${owner}/${repo}/src/${branch}/${path}`;
                const res = await fetch(url, { headers: this.headers });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                return (await res.json());
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1);
            const trace = this._trace("getFileContent", statusCode, Date.now() - start, retryCount);
            return { file, trace };
        }
        catch (err) {
            const trace = this._trace("getFileContent", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RepoAdapter.getFileContent failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // getDecodedFileContent — fetch + base64-decode a file; enforces 100 KB guard
    // -------------------------------------------------------------------------
    async getDecodedFileContent(owner, repo, path, ref) {
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
    _trace(operation, statusCode, latencyMs, retryCount, error) {
        const trace = {
            adapter: "repo-adapter",
            operation,
            statusCode,
            latencyMs,
            retryCount,
            error,
        };
        logger.adapterCall({ adapter: "repo-adapter", operation, statusCode, latencyMs, retryCount, error });
        return trace;
    }
}
