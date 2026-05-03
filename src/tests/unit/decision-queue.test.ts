/**
 * Tests for DecisionQueue — enqueue, approve, reject, ring eviction.
 * Stubs AgentEventBus to avoid side effects.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../agents/AgentEventBus.js", () => ({
  AgentEventBus: { emit: vi.fn(), subscribe: vi.fn(() => () => {}), replay: vi.fn(() => []) },
}));

// Re-import fresh instance for each test via module re-evaluation trick
// We access the singleton directly since it's the module export.
import { DecisionQueue } from "../../decisions/DecisionQueue.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function flush() { return new Promise(r => setTimeout(r, 0)); }

// ─── tests ──────────────────────────────────────────────────────────────────

describe("DecisionQueue", () => {
  beforeEach(() => {
    // Clear internal state via the test helper exposed by the module
    DecisionQueue._resetForTests?.();
  });

  describe("enqueue", () => {
    it("returns a Promise that does not resolve immediately", async () => {
      let resolved = false;
      const p = DecisionQueue.enqueue("agent-1", "run-1", "plan_step", { step: 1 });
      p.then(() => { resolved = true; });
      await flush();
      expect(resolved).toBe(false);
    });

    it("adds the decision to the list", () => {
      DecisionQueue.enqueue("agent-2", "run-2", "tool_call", { tool: "search" });
      const all = DecisionQueue.list();
      expect(all.some(d => d.agent === "agent-2")).toBe(true);
    });

    it("new decision has status pending", () => {
      DecisionQueue.enqueue("agent-3", "run-3", "action", {});
      const d = DecisionQueue.list().find(d => d.agent === "agent-3");
      expect(d?.status).toBe("pending");
    });
  });

  describe("approve", () => {
    it("resolves the awaited Promise with approved decision", async () => {
      const p = DecisionQueue.enqueue("agent-a", "run-a", "create_issue", { title: "test" });
      const all = DecisionQueue.list();
      const d = all.find(x => x.agent === "agent-a")!;
      DecisionQueue.approve(d.id);
      const result = await p;
      expect(result.status).toBe("approved");
      expect(result.id).toBe(d.id);
    });

    it("sets resolution.resolved_at", async () => {
      const p = DecisionQueue.enqueue("agent-b", "run-b", "post_comment", {});
      const d = DecisionQueue.list().find(x => x.agent === "agent-b")!;
      DecisionQueue.approve(d.id);
      await p;
      const updated = DecisionQueue.list().find(x => x.id === d.id)!;
      expect(updated.resolution?.resolved_at).toBeDefined();
    });
  });

  describe("reject", () => {
    it("resolves the awaited Promise with rejected decision", async () => {
      const p = DecisionQueue.enqueue("agent-c", "run-c", "merge_pr", {});
      const d = DecisionQueue.list().find(x => x.agent === "agent-c")!;
      DecisionQueue.reject(d.id, "too risky");
      const result = await p;
      expect(result.status).toBe("rejected");
      expect(result.resolution?.reason).toBe("too risky");
    });
  });

  describe("modify", () => {
    it("merges patch into payload and sets status modified", async () => {
      const p = DecisionQueue.enqueue("agent-d", "run-d", "plan", { x: 1 });
      const d = DecisionQueue.list().find(x => x.agent === "agent-d")!;
      DecisionQueue.modify(d.id, { y: 2 });
      const result = await p;
      expect(result.status).toBe("modified");
      expect(result.resolution?.patch).toEqual({ y: 2 });
    });
  });

  describe("ring eviction", () => {
    it("evicts oldest pending when capacity exceeded", async () => {
      // Reset first
      DecisionQueue._resetForTests?.();
      // Fill to capacity + 1 without resolving
      const MAX = 500;
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < MAX + 1; i++) {
        promises.push(DecisionQueue.enqueue(`agent`, `run-${i}`, "step", { i }));
      }
      const all = DecisionQueue.list();
      // Should not exceed MAX
      expect(all.length).toBeLessThanOrEqual(MAX);
    });
  });
});
