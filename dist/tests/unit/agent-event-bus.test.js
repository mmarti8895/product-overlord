/**
 * Unit tests for AgentEventBus — publish, subscribe, ring buffer, SSE filter.
 */
import { describe, it, expect, vi } from "vitest";
import { AgentEventBus } from "../../agents/AgentEventBus.js";
// Helper to build a start event
function makeStart(agent, run_id = "run-1") {
    return { event: "start", agent, run_id, ts: new Date().toISOString() };
}
function makeProgress(agent, run_id = "run-1", pct = 50) {
    return { event: "progress", agent, run_id, pct, msg: "working", ts: new Date().toISOString() };
}
function makeFinish(agent, run_id = "run-1") {
    return { event: "finish", agent, run_id, status: "ok", duration_ms: 100, ts: new Date().toISOString() };
}
describe("AgentEventBus", () => {
    // Clear ring buffer between tests by draining via a fresh subscribe — 
    // we can't reset the singleton, so tests must be order-tolerant.
    describe("subscribe / emit", () => {
        it("delivers emitted events to subscriber", () => {
            const received = [];
            const unsub = AgentEventBus.subscribe(e => received.push(e));
            const evt = makeStart("test-agent");
            AgentEventBus.emit(evt);
            unsub();
            expect(received).toContainEqual(expect.objectContaining({ event: "start", agent: "test-agent" }));
        });
        it("unsubscribe stops delivery", () => {
            const received = [];
            const unsub = AgentEventBus.subscribe(e => received.push(e));
            unsub();
            AgentEventBus.emit(makeStart("ghost-agent"));
            expect(received.some(e => e.agent === "ghost-agent")).toBe(false);
        });
        it("multiple subscribers all receive the event", () => {
            const a = [];
            const b = [];
            const u1 = AgentEventBus.subscribe(e => a.push(e));
            const u2 = AgentEventBus.subscribe(e => b.push(e));
            AgentEventBus.emit(makeProgress("multi-agent", "run-multi"));
            u1();
            u2();
            expect(a.some(e => e.agent === "multi-agent")).toBe(true);
            expect(b.some(e => e.agent === "multi-agent")).toBe(true);
        });
        it("subscriber error does not crash the bus", () => {
            const good = [];
            const badSub = vi.fn().mockImplementation(() => { throw new Error("boom"); });
            const u1 = AgentEventBus.subscribe(badSub);
            const u2 = AgentEventBus.subscribe(e => good.push(e));
            expect(() => AgentEventBus.emit(makeStart("resilient-agent"))).not.toThrow();
            u1();
            u2();
            expect(good.some(e => e.agent === "resilient-agent")).toBe(true);
        });
    });
    describe("replay()", () => {
        it("returns all recent events without filter", () => {
            AgentEventBus.emit(makeStart("replay-agent", "run-replay"));
            const all = AgentEventBus.replay();
            expect(all.length).toBeGreaterThan(0);
        });
        it("filters by agent name", () => {
            const unique = `filter-agent-${Date.now()}`;
            AgentEventBus.emit(makeStart(unique, "run-filter"));
            AgentEventBus.emit(makeStart("other-agent", "run-other"));
            const filtered = AgentEventBus.replay(unique);
            expect(filtered.every(e => e.agent === unique)).toBe(true);
            expect(filtered.some(e => e.agent === unique)).toBe(true);
        });
    });
    describe("helper emitters", () => {
        it("start() emits a start event", () => {
            const received = [];
            const unsub = AgentEventBus.subscribe(e => received.push(e));
            AgentEventBus.start("helper-agent", "run-h1");
            unsub();
            expect(received.some(e => e.event === "start" && e.agent === "helper-agent")).toBe(true);
        });
        it("progress() emits a progress event with pct", () => {
            const received = [];
            const unsub = AgentEventBus.subscribe(e => received.push(e));
            AgentEventBus.progress("helper-agent", "run-h2", 42, "half done");
            unsub();
            const e = received.find(e => e.event === "progress" && e.agent === "helper-agent");
            expect(e).toBeDefined();
            if (e?.event === "progress")
                expect(e.pct).toBe(42);
        });
        it("finish() emits a finish event", () => {
            const received = [];
            const unsub = AgentEventBus.subscribe(e => received.push(e));
            AgentEventBus.finish("helper-agent", "run-h3", "ok", 500);
            unsub();
            expect(received.some(e => e.event === "finish" && e.agent === "helper-agent")).toBe(true);
        });
    });
    describe("ring buffer", () => {
        it("does not exceed RING_SIZE (2000)", () => {
            for (let i = 0; i < 2100; i++) {
                AgentEventBus.emit(makeStart(`ring-agent-${i}`, `run-ring-${i}`));
            }
            const all = AgentEventBus.replay();
            expect(all.length).toBeLessThanOrEqual(2000);
        });
    });
});
