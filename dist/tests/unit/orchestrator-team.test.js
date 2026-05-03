/**
 * Unit tests for OrchestratorTeam monitors — inject mock events, assert findings emitted.
 * Uses real AgentEventBus so event flow is exercised end-to-end within process.
 * Stubs file I/O to avoid disk writes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("fs", async (importOriginal) => {
    const orig = await importOriginal();
    return { ...orig, appendFileSync: vi.fn(), mkdirSync: vi.fn(), existsSync: vi.fn(() => true) };
});
vi.mock("../../agents/AgentRegistry.js", () => ({
    AgentRegistry: {
        register: vi.fn(),
        deregister: vi.fn(),
        stopRun: vi.fn(),
        stopAgent: vi.fn(),
        listRuns: vi.fn(() => []),
    },
}));
import { AgentEventBus } from "../../agents/AgentEventBus.js";
import { OrchestratorTeam } from "../../orchestrators/OrchestratorTeam.js";
function emitStart(agent, run_id) {
    AgentEventBus.emit({ event: "start", agent, run_id, ts: new Date().toISOString() });
}
function emitProgress(agent, run_id) {
    AgentEventBus.emit({ event: "progress", agent, run_id, pct: 10, msg: "working", ts: new Date().toISOString() });
}
describe("OrchestratorTeam", () => {
    beforeEach(() => {
        OrchestratorTeam.start();
    });
    afterEach(() => {
        OrchestratorTeam.stop();
    });
    describe("thrash detection", () => {
        it("emits a critical finding when agent exceeds event threshold", () => {
            const agent = `thrash-agent-${Date.now()}`;
            const run_id = `run-thrash-${Date.now()}`;
            // THRASH_THRESHOLD is 10 — emit 12 start/progress events
            for (let i = 0; i < 12; i++) {
                emitStart(agent, run_id);
            }
            const findings = OrchestratorTeam.list();
            const thrashFinding = findings.find(f => f.agent === agent && f.type === "thrash" && f.severity === "critical");
            expect(thrashFinding).toBeDefined();
        });
        it("finding status starts as open", () => {
            const agent = `thrash-open-${Date.now()}`;
            const run_id = `run-thrash-open-${Date.now()}`;
            for (let i = 0; i < 12; i++)
                emitStart(agent, run_id);
            const finding = OrchestratorTeam.list().find(f => f.agent === agent);
            expect(finding?.status).toBe("open");
        });
    });
    describe("ack / escalate", () => {
        it("ack sets status to acked", () => {
            const agent = `ack-agent-${Date.now()}`;
            const run_id = `run-ack-${Date.now()}`;
            for (let i = 0; i < 12; i++)
                emitStart(agent, run_id);
            const finding = OrchestratorTeam.list().find(f => f.agent === agent);
            expect(finding).toBeDefined();
            const updated = OrchestratorTeam.ack(finding.id);
            expect(updated?.status).toBe("acked");
        });
        it("escalate sets status to escalated", () => {
            const agent = `esc-agent-${Date.now()}`;
            const run_id = `run-esc-${Date.now()}`;
            for (let i = 0; i < 12; i++)
                emitStart(agent, run_id);
            const finding = OrchestratorTeam.list().find(f => f.agent === agent);
            expect(finding).toBeDefined();
            const updated = OrchestratorTeam.escalate(finding.id);
            expect(updated?.status).toBe("escalated");
        });
        it("ack returns null for unknown id", () => {
            expect(OrchestratorTeam.ack("not-a-real-id")).toBeNull();
        });
    });
    describe("list / get", () => {
        it("list returns an array", () => {
            expect(Array.isArray(OrchestratorTeam.list())).toBe(true);
        });
        it("get returns undefined for unknown id", () => {
            expect(OrchestratorTeam.get("bogus-id")).toBeUndefined();
        });
        it("list with status filter works", () => {
            const open = OrchestratorTeam.list("open");
            expect(open.every(f => f.status === "open")).toBe(true);
        });
    });
});
