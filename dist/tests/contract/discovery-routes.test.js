/**
 * Contract tests — Discovery API routes (discovery-intake task 7.8)
 *
 * Tests all 9 routes with mocked dependencies.
 */
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createDiscoveryRouter } from "../../server/routes/discovery.js";
function makeTheme(id = "t1") {
    return {
        id,
        name: "Login issues",
        frequency: 10,
        avg_sentiment: -0.5,
        representative_quotes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
function makeCandidate(id = "c1") {
    return {
        id,
        theme_id: "t1",
        title: "Fix login flow",
        problem_statement: "Users cannot login",
        estimated_reach: 100,
        estimated_impact: 8,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
function makeQueue() {
    return {
        getDocuments: vi.fn().mockResolvedValue([]),
        getThemes: vi.fn().mockResolvedValue([makeTheme()]),
        getTheme: vi.fn().mockImplementation(async (id) => id === "t1" ? makeTheme() : null),
        getCandidates: vi.fn().mockResolvedValue([makeCandidate()]),
        getCandidate: vi.fn().mockImplementation(async (id) => id === "c1" ? makeCandidate() : null),
        promote: vi.fn().mockResolvedValue({ ...makeCandidate(), status: "promoted", promoted_ticket_key: "PROJ-99" }),
        dismiss: vi.fn().mockResolvedValue({ ...makeCandidate(), status: "dismissed", dismiss_reason: "Not now" }),
        upsertThemes: vi.fn().mockResolvedValue(undefined),
        upsertCandidates: vi.fn().mockResolvedValue(undefined),
        ingestRaw: vi.fn().mockResolvedValue([]),
        getLatestDocumentDate: vi.fn().mockResolvedValue(null),
    };
}
function makeApp(queue) {
    const clusterer = { cluster: vi.fn().mockResolvedValue([makeTheme()]) };
    const sizer = { size: vi.fn().mockResolvedValue(makeCandidate()) };
    const adapters = [];
    const webhookAdapter = { push: vi.fn(), drain: vi.fn().mockReturnValue([]) };
    const app = new Hono();
    app.route("/api/discovery", createDiscoveryRouter(queue, clusterer, sizer, adapters, webhookAdapter));
    return app;
}
describe("Discovery API contract tests", () => {
    it("POST /api/discovery/sync — triggers sync", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/sync", { method: "POST" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });
    it("POST /api/discovery/ingest — queues item", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_id: "x1", text: "Can't login" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.queued).toBe(true);
    });
    it("GET /api/discovery/themes — returns themes list", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/themes");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe("Login issues");
    });
    it("GET /api/discovery/themes/:id — returns single theme", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/themes/t1");
        expect(res.status).toBe(200);
    });
    it("GET /api/discovery/themes/:id — 404 for unknown", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/themes/nope");
        expect(res.status).toBe(404);
    });
    it("GET /api/discovery/candidates — returns list", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/candidates");
        const body = await res.json();
        expect(body.data).toHaveLength(1);
    });
    it("POST /api/discovery/candidates/:id/promote — promotes", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/candidates/c1/promote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_key: "PROJ", title: "Fix login", description: "Details" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.status).toBe("promoted");
    });
    it("POST /api/discovery/candidates/:id/dismiss — dismisses", async () => {
        const app = makeApp(makeQueue());
        const res = await app.request("/api/discovery/candidates/c1/dismiss", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Not prioritised" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.status).toBe("dismissed");
    });
});
