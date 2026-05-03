/**
 * Integration tests for the agent-orchestration pipeline:
 *   13.12 — full pipeline crawl-jira → normalise → embed → upsert with mocked connections
 *   13.13 — stop workflow mid-run; all stages halt within 3 s
 *   13.14 — thrash detection; finding emitted within 2 ticks
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
// Stub file I/O
vi.mock("fs", async (importOriginal) => {
    const orig = await importOriginal();
    return { ...orig, appendFileSync: vi.fn(), mkdirSync: vi.fn(), existsSync: vi.fn(() => false), writeFileSync: vi.fn(), readFileSync: vi.fn(() => "[]") };
});
// Stub ConnectionManager — return fake creds
vi.mock("../../connections/ConnectionManager.js", () => ({
    ConnectionManager: {
        loadRaw: vi.fn().mockResolvedValue({
            baseUrl: "https://test.atlassian.net", projectKey: "TEST", token: "fake-token",
            apiKey: "sk-fake", plannerModel: "gpt-4o-mini", executorModel: "gpt-4o-mini",
            reviewerModel: "gpt-4o-mini", tpmBudget: 100000, rpmBudget: 60,
            pat: "ghp_fake", repos: ["org/repo"], branchFilter: "main",
        }),
        save: vi.fn(), load: vi.fn(), test: vi.fn().mockResolvedValue({ ok: true, latency_ms: 5 }),
    },
}));
vi.mock("../../agents/AgentRegistry.js", () => ({
    AgentRegistry: {
        register: vi.fn(), deregister: vi.fn(), stopRun: vi.fn(), stopAgent: vi.fn(),
        listRuns: vi.fn(() => []),
    },
}));
import { WorkflowEngine } from "../../workflows/WorkflowEngine.js";
import { AgentEventBus } from "../../agents/AgentEventBus.js";
import { OrchestratorTeam } from "../../orchestrators/OrchestratorTeam.js";
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
// ─── 13.12 ──────────────────────────────────────────────────────────────────
describe("13.12 — full pipeline integration", () => {
    it("runs crawl-jira → normalise → embed → upsert-lancedb to completion", async () => {
        const stages = ["crawl-jira", "normalise", "embed", "upsert-lancedb"];
        const run_id = await WorkflowEngine.run(stages);
        expect(typeof run_id).toBe("string");
        // Wait for all stubs (~200ms each × 4) plus buffer
        await wait(1500);
        const run = WorkflowEngine.getRun(run_id);
        expect(run).toBeDefined();
        expect(run?.status).toBe("completed");
        expect(run?.stages).toEqual(stages);
    }, 5000);
    it("records_processed is positive after successful run", async () => {
        const run_id = await WorkflowEngine.run(["crawl-jira", "normalise"]);
        await wait(800);
        const run = WorkflowEngine.getRun(run_id);
        expect(run?.records_processed).toBeGreaterThan(0);
    }, 5000);
});
// ─── 13.13 ──────────────────────────────────────────────────────────────────
describe("13.13 — stop workflow mid-run", () => {
    it("halts within 3 s of stop() call", async () => {
        // Use many stages so the run doesn't complete before we call stop()
        const stages = ["crawl-docs", "crawl-jira", "crawl-github", "normalise", "enrich", "embed", "upsert-lancedb"];
        const run_id = await WorkflowEngine.run(stages);
        // Let it start executing the first stage
        await wait(50);
        const stopStart = Date.now();
        WorkflowEngine.stop(run_id);
        // Poll until stopped or 3 s elapsed
        let run = WorkflowEngine.getRun(run_id);
        while (run?.status === "running" && Date.now() - stopStart < 3000) {
            await wait(100);
            run = WorkflowEngine.getRun(run_id);
        }
        expect(Date.now() - stopStart).toBeLessThan(3000);
        expect(run?.status).toBe("stopped");
    }, 6000);
});
// ─── 13.14 ──────────────────────────────────────────────────────────────────
describe("13.14 — thrash detection within 2 ticks", () => {
    beforeAll(() => { OrchestratorTeam.start(); });
    afterAll(() => { OrchestratorTeam.stop(); });
    it("emits a thrash finding after >10 events in 30 s window", async () => {
        const agent = `integration-thrash-${Date.now()}`;
        const run_id = `run-thrash-int-${Date.now()}`;
        // THRASH_THRESHOLD = 10 — emit 15 start events synchronously
        for (let i = 0; i < 15; i++) {
            AgentEventBus.emit({ event: "start", agent, run_id, ts: new Date().toISOString() });
        }
        // Wait up to 2 ticks (5 s each = 10 s max; finding is synchronous on event handler so much faster)
        await wait(200);
        const findings = OrchestratorTeam.list();
        const thrash = findings.find(f => f.agent === agent && f.type === "thrash");
        expect(thrash).toBeDefined();
        expect(thrash?.severity).toBe("critical");
    }, 12_000);
});
