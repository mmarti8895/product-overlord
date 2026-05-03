/**
 * Unit tests for WorkflowEngine — stage sequencing, abort propagation, plan-mode output.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../agents/AgentEventBus.js", () => ({
  AgentEventBus: {
    emit: vi.fn(), subscribe: vi.fn(() => () => {}), replay: vi.fn(() => []),
    start: vi.fn(), progress: vi.fn(), finish: vi.fn(), delay: vi.fn(), finding: vi.fn(),
  },
}));

import { WorkflowEngine } from "../../workflows/WorkflowEngine.js";

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }

describe("WorkflowEngine", () => {
  beforeEach(() => {
    // No global state reset needed — each run gets a unique run_id
  });

  describe("plan()", () => {
    it("returns a PlanResult with stages array", async () => {
      const result = await WorkflowEngine.plan(["crawl-docs", "normalise", "embed"]);
      expect(result.stages).toHaveLength(3);
      expect(result.stages[0].name).toBe("crawl-docs");
    });

    it("estimated_tokens is positive", async () => {
      const result = await WorkflowEngine.plan(["normalise", "embed"]);
      expect(result.estimated_tokens).toBeGreaterThan(0);
    });

    it("estimated_cost_usd is positive", async () => {
      const result = await WorkflowEngine.plan(["embed"]);
      expect(result.estimated_cost_usd).toBeGreaterThan(0);
    });

    it("returns a stage entry for each requested stage", async () => {
      const stages = ["crawl-jira", "normalise", "upsert-lancedb"];
      const result = await WorkflowEngine.plan(stages);
      const names = result.stages.map(s => s.name);
      expect(names).toEqual(stages);
    });
  });

  describe("run()", () => {
    it("returns a run_id string", async () => {
      const id = await WorkflowEngine.run(["crawl-docs"]);
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("run appears in listRuns()", async () => {
      const id = await WorkflowEngine.run(["normalise"]);
      await wait(10);
      const runs = WorkflowEngine.listRuns();
      const match = runs.find(r => r.run_id === id);
      expect(match).toBeDefined();
    });

    it("run eventually reaches completed status", async () => {
      const id = await WorkflowEngine.run(["crawl-docs"]);
      // Wait for all stage stubs (each ~200ms) plus buffer
      await wait(600);
      const run = WorkflowEngine.getRun(id);
      expect(run?.status).toBe("completed");
    });
  });

  describe("stop()", () => {
    it("returns false for unknown run_id", () => {
      expect(WorkflowEngine.stop("nonexistent-id")).toBe(false);
    });

    it("marks run as stopped and abort propagates", async () => {
      const id = await WorkflowEngine.run(["crawl-docs", "normalise", "embed", "upsert-lancedb"]);
      await wait(50); // let it start
      WorkflowEngine.stop(id);
      await wait(300);
      const run = WorkflowEngine.getRun(id);
      expect(run?.status).toBe("stopped");
    });
  });

  describe("listRuns() / getRun()", () => {
    it("getRun returns undefined for unknown id", () => {
      expect(WorkflowEngine.getRun("no-such-id")).toBeUndefined();
    });

    it("listRuns returns an array", async () => {
      const runs = WorkflowEngine.listRuns();
      expect(Array.isArray(runs)).toBe(true);
    });
  });
});
