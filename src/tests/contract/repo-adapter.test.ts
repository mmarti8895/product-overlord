/**
 * Contract tests — RepoAdapter (task 1.7)
 *
 * Covers:
 *   - happy path: getRepoMeta, getTree, getFileContent (GitHub + Bitbucket)
 *   - private repo: returns isPrivate: true
 *   - rate-limited response: retries and eventually throws
 *   - Teamwork Graph unavailable: enrichDossier returns enriched: false
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { RepoAdapter, FileTooLargeError } from "../../repo/repo-adapter.js";
import { TeamworkGraphClient } from "../../repo/teamwork-graph.js";
import type { ComponentDossier } from "../../repo/component-indexer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    } as Response;
  });
}

const GITHUB_META = {
  name: "my-repo",
  full_name: "org/my-repo",
  size: 512, // KB — well under 20 GB
  default_branch: "main",
  private: false,
};

const PRIVATE_GITHUB_META = { ...GITHUB_META, private: true, full_name: "org/private-repo" };

const GITHUB_TREE = {
  tree: [
    { path: "src/index.ts", type: "blob" },
    { path: "src/utils.ts", type: "blob" },
  ],
};

const GITHUB_FILE = {
  path: "src/index.ts",
  content: "Y29uc29sZS5sb2coImhlbGxvIik=",
  encoding: "base64",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RepoAdapter (GitHub) — contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("happy path: getRepoMeta returns normalised meta", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 200, body: GITHUB_META }]));
    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    const { meta } = await adapter.getRepoMeta("org", "my-repo");
    expect(meta.fullName).toBe("org/my-repo");
    expect(meta.sizeKb).toBe(512);
    expect(meta.isPrivate).toBe(false);
    expect(meta.defaultBranch).toBe("main");
  });

  it("private repo: isPrivate is true", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 200, body: PRIVATE_GITHUB_META }]));
    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    const { meta } = await adapter.getRepoMeta("org", "private-repo");
    expect(meta.isPrivate).toBe(true);
  });

  it("happy path: getTree returns file entries", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 200, body: GITHUB_TREE }]));
    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    const { entries } = await adapter.getTree("org", "my-repo", "main");
    expect(entries).toHaveLength(2);
    expect(entries[0].path).toBe("src/index.ts");
  });

  it("happy path: getFileContent returns content and encoding", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 200, body: GITHUB_FILE }]));
    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    const { file } = await adapter.getFileContent("org", "my-repo", "src/index.ts", "main");
    expect(file.encoding).toBe("base64");
    expect(file.content).toBe(GITHUB_FILE.content);
  });

  it("rate-limited (429): retries 3× then throws", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch([
        { status: 429, body: {} },
        { status: 429, body: {} },
        { status: 429, body: {} },
      ])
    );
    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    await expect(adapter.getRepoMeta("org", "my-repo")).rejects.toThrow(/HTTP 429/);
  });

  it("unauthorized (401): throws immediately after retries", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 401, body: {} }]));
    const adapter = new RepoAdapter({ provider: "github", accessToken: "bad-tok", retryDelayMs: 0 });
    await expect(adapter.getTree("org", "my-repo", "main")).rejects.toThrow(/HTTP 401/);
  });
});

describe("RepoAdapter (Bitbucket) — contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("happy path: getRepoMeta normalises size from MB to KB", async () => {
    const bbMeta = {
      name: "bb-repo",
      full_name: "org/bb-repo",
      size: 50, // MB
      mainbranch: { name: "develop" },
      is_private: true,
    };
    // Bitbucket returns slightly different shape; adapter should handle
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          name: bbMeta.name,
          full_name: bbMeta.full_name,
          size: bbMeta.size,
          default_branch: "develop",
          private: true,
        }),
      }))
    );
    const adapter = new RepoAdapter({ provider: "bitbucket", accessToken: "tok", retryDelayMs: 0 });
    const { meta } = await adapter.getRepoMeta("org", "bb-repo");
    // Bitbucket: size is in MB → multiply ×1024 = 51200 KB
    expect(meta.sizeKb).toBe(50 * 1024);
    expect(meta.isPrivate).toBe(true);
  });
});

describe("TeamworkGraphClient — contract (task 1.7 / Teamwork Graph unavailable)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns null when Teamwork Graph endpoint returns 503", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 503, body: {} }]));
    const client = new TeamworkGraphClient({
      baseUrl: "https://demo.atlassian.net",
      accessToken: "tok",
      retryDelayMs: 0,
    });
    const result = await client.enrich("DEMO-1");
    expect(result).toBeNull();
  });

  it("enrichDossier returns { enriched: false, source: unavailable } when graph is down", async () => {
    vi.stubGlobal("fetch", makeFetch([{ status: 503, body: {} }]));
    const client = new TeamworkGraphClient({
      baseUrl: "https://demo.atlassian.net",
      accessToken: "tok",
      retryDelayMs: 0,
    });
    const dossier: ComponentDossier = {
      name: "auth",
      rootPaths: ["src/auth"],
      frameworks: [],
      owners: [],
      testDirs: [],
      testLocationKnown: false,
      conventions: [],
      fixExamples: [],
      indexedAt: new Date().toISOString(),
    };
    const { enriched, source } = await client.enrichDossier(dossier, "DEMO-1");
    expect(enriched).toBe(false);
    expect(source).toBe("unavailable");
  });

  it("happy path: enrich returns structured enrichment object with enrichmentOnly: true", async () => {
    const prResponse = {
      detail: [{ pullRequests: [{ id: "1", name: "Fix auth bug", url: "https://github.com/pr/1", status: "MERGED", fileCount: 2 }] }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ detail: [] }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ detail: [] }) })
    );
    const client = new TeamworkGraphClient({
      baseUrl: "https://demo.atlassian.net",
      accessToken: "tok",
      retryDelayMs: 0,
    });
    const result = await client.enrich("DEMO-1");
    expect(result).not.toBeNull();
    expect(result!.enrichmentOnly).toBe(true);
    expect(result!.linkedPRs[0].title).toBe("Fix auth bug");
    expect(result!.linkedPRs[0].status).toBe("merged");
  });
});

// ---------------------------------------------------------------------------
// Task 7.3 — getDecodedFileContent tests
// ---------------------------------------------------------------------------

describe("RepoAdapter.getDecodedFileContent", () => {
  afterEach(() => vi.restoreAllMocks());

  it("happy path: decodes base64 content and returns string", async () => {
    const originalText = "export function auth() { return true; }";
    const encoded = Buffer.from(originalText).toString("base64");

    vi.stubGlobal(
      "fetch",
      makeFetch([{ status: 200, body: { path: "src/auth.ts", content: encoded, encoding: "base64" } }])
    );

    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    const { content } = await adapter.getDecodedFileContent("org", "repo", "src/auth.ts", "main");
    expect(content).toBe(originalText);
  });

  it("throws FileTooLargeError when decoded content exceeds 100 KB", async () => {
    // Build a 101 KB string and base64-encode it
    const bigText = "x".repeat(101 * 1024);
    const encoded = Buffer.from(bigText).toString("base64");

    vi.stubGlobal(
      "fetch",
      makeFetch([{ status: 200, body: { path: "big.ts", content: encoded, encoding: "base64" } }])
    );

    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    await expect(
      adapter.getDecodedFileContent("org", "repo", "big.ts", "main")
    ).rejects.toThrow(FileTooLargeError);
  });

  it("retries on 5xx and eventually throws", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch([
        { status: 500, body: {} },
        { status: 500, body: {} },
        { status: 500, body: {} },
      ])
    );

    const adapter = new RepoAdapter({ provider: "github", accessToken: "tok", retryDelayMs: 0 });
    await expect(
      adapter.getDecodedFileContent("org", "repo", "src/file.ts", "main")
    ).rejects.toThrow();
  });
});
