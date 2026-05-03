/**
 * Contract tests — KB HTTP endpoints (Task 6.6)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
// vi.hoisted ensures the mock object is available inside vi.mock factory
const { mockKB } = vi.hoisted(() => {
    const mockKB = {
        ingestFile: vi.fn(),
        crawlUrl: vi.fn(),
        listSources: vi.fn(),
        deleteSource: vi.fn(),
    };
    return { mockKB };
});
vi.mock("../../knowledge/index.js", () => ({
    KnowledgeBase: class {
        ingestFile = mockKB.ingestFile;
        crawlUrl = mockKB.crawlUrl;
        listSources = mockKB.listSources;
        deleteSource = mockKB.deleteSource;
    },
}));
import { createApp } from "../../server/app.js";
import { FileTooLargeError, StoreFullError, UnsupportedFormatError } from "../../knowledge/types.js";
function makeConfig(flagOverrides = {}) {
    return {
        port: 3000,
        baseUrl: "http://localhost:3000",
        nodeEnv: "test",
        jiraBaseUrl: undefined,
        jiraAccessToken: undefined,
        rovoMcpCloudId: undefined,
        rovoMcpAccessToken: undefined,
        githubAccessToken: undefined,
        bitbucketAccessToken: undefined,
        featureFlags: {
            repoGroundingEnabled: false,
            jiraIngestionEnabled: false,
            rovoMcpEnabled: false,
            shadowModeOnly: false,
            a2aEnabled: false,
            llmEnabled: false,
            ...flagOverrides,
        },
        llm: { apiKey: undefined, baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", embeddingModel: "text-embedding-3-small", callsPerMinute: 60, degraded: true },
        kb: { storePath: "./.kb-test", maxSizeGb: 1 },
        uiDevEndpoints: true,
    };
}
let app;
beforeEach(() => {
    mockKB.ingestFile.mockReset();
    mockKB.crawlUrl.mockReset();
    mockKB.listSources.mockReset();
    mockKB.deleteSource.mockReset();
    app = createApp(makeConfig());
});
// POST /kb/ingest
describe("POST /kb/ingest", () => {
    it("returns 201 on successful ingest", async () => {
        mockKB.ingestFile.mockResolvedValue({ source_id: "src-1", chunk_count: 3, size_bytes: 1024, indexed_at: new Date().toISOString() });
        const form = new FormData();
        form.append("file", new File(["# Hello"], "doc.md", { type: "text/plain" }));
        form.append("project_key", "PROJ");
        const res = await app.request("/kb/ingest", { method: "POST", body: form });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.source_id).toBe("src-1");
    });
    it("returns 400 when project_key is missing", async () => {
        const form = new FormData();
        form.append("file", new File(["content"], "doc.md"));
        const res = await app.request("/kb/ingest", { method: "POST", body: form });
        expect(res.status).toBe(400);
    });
    it("returns 413 when file is too large", async () => {
        mockKB.ingestFile.mockRejectedValue(new FileTooLargeError("doc.pdf", 60 * 1024 * 1024, 50 * 1024 * 1024));
        const form = new FormData();
        form.append("file", new File(["x"], "doc.pdf"));
        form.append("project_key", "PROJ");
        const res = await app.request("/kb/ingest", { method: "POST", body: form });
        expect(res.status).toBe(413);
    });
    it("returns 422 for unsupported file type", async () => {
        mockKB.ingestFile.mockRejectedValue(new UnsupportedFormatError(".xyz"));
        const form = new FormData();
        form.append("file", new File(["data"], "data.xyz"));
        form.append("project_key", "PROJ");
        const res = await app.request("/kb/ingest", { method: "POST", body: form });
        expect(res.status).toBe(422);
    });
    it("returns 507 when KB store is full", async () => {
        mockKB.ingestFile.mockRejectedValue(new StoreFullError(5.01, 5));
        const form = new FormData();
        form.append("file", new File(["content"], "doc.txt"));
        form.append("project_key", "PROJ");
        const res = await app.request("/kb/ingest", { method: "POST", body: form });
        expect(res.status).toBe(507);
    });
    it("returns 403 in shadow mode", async () => {
        const shadowApp = createApp(makeConfig({ shadowModeOnly: true }));
        const form = new FormData();
        form.append("file", new File(["content"], "doc.txt"));
        form.append("project_key", "PROJ");
        const res = await shadowApp.request("/kb/ingest", { method: "POST", body: form });
        expect(res.status).toBe(403);
    });
});
// POST /kb/crawl
describe("POST /kb/crawl", () => {
    it("returns 201 on successful crawl", async () => {
        mockKB.crawlUrl.mockResolvedValue({ source_id: "src-2", chunk_count: 5, size_bytes: 2048, indexed_at: new Date().toISOString() });
        const res = await app.request("/kb/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://example.com/docs", project_key: "PROJ" }) });
        expect(res.status).toBe(201);
    });
    it("returns 400 when url or project_key missing", async () => {
        const res = await app.request("/kb/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://example.com" }) });
        expect(res.status).toBe(400);
    });
    it("returns 507 when store is full", async () => {
        mockKB.crawlUrl.mockRejectedValue(new StoreFullError(5.1, 5));
        const res = await app.request("/kb/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://example.com", project_key: "PROJ" }) });
        expect(res.status).toBe(507);
    });
    it("returns 403 in shadow mode", async () => {
        const shadowApp = createApp(makeConfig({ shadowModeOnly: true }));
        const res = await shadowApp.request("/kb/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://example.com", project_key: "PROJ" }) });
        expect(res.status).toBe(403);
    });
});
// GET /kb/sources
describe("GET /kb/sources", () => {
    it("returns 200 with sources list", async () => {
        mockKB.listSources.mockResolvedValue([{ source_id: "src-1", project_key: "PROJ", source_type: "kt", format: "markdown", name: "doc.md", origin: "doc.md", chunk_count: 3, indexed_at: new Date().toISOString(), size_bytes: 1024 }]);
        const res = await app.request("/kb/sources?project_key=PROJ");
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveLength(1);
    });
    it("returns 400 when project_key is missing", async () => {
        const res = await app.request("/kb/sources");
        expect(res.status).toBe(400);
    });
});
// DELETE /kb/sources/:id
describe("DELETE /kb/sources/:id", () => {
    it("returns 204 on success", async () => {
        mockKB.deleteSource.mockResolvedValue(undefined);
        const res = await app.request("/kb/sources/src-1", { method: "DELETE" });
        expect(res.status).toBe(204);
    });
    it("returns 403 in shadow mode", async () => {
        const shadowApp = createApp(makeConfig({ shadowModeOnly: true }));
        const res = await shadowApp.request("/kb/sources/src-1", { method: "DELETE" });
        expect(res.status).toBe(403);
    });
});
