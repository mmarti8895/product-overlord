/**
 * Unit tests for WorkflowScheduler — schedule CRUD, next-run calculation.
 * Stubs node-cron and file I/O.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub node-cron so no real timers fire
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(() => ({ stop: vi.fn() })),
    validate: vi.fn((expr: string) => /^[\d\s\*\/\-,]+$/.test(expr) || expr === "0 2 * * *"),
  },
}));

// Stub fs so no real file writes happen
vi.mock("fs", async (importOriginal) => {
  const orig = await importOriginal<typeof import("fs")>();
  return {
    ...orig,
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => "[]"),
    writeFileSync: vi.fn(),
  };
});

vi.mock("../../agents/AgentEventBus.js", () => ({
  AgentEventBus: {
    emit: vi.fn(), subscribe: vi.fn(() => () => {}), replay: vi.fn(() => []),
    start: vi.fn(), progress: vi.fn(), finish: vi.fn(),
  },
}));

vi.mock("../../workflows/WorkflowEngine.js", () => ({
  WorkflowEngine: { run: vi.fn().mockResolvedValue("mock-run-id"), plan: vi.fn(), stop: vi.fn(), listRuns: vi.fn(() => []) },
}));

import { WorkflowScheduler } from "../../workflows/WorkflowScheduler.js";

describe("WorkflowScheduler", () => {
  beforeEach(() => {
    // Clear internal schedules via upsert/delete cycle — no direct reset needed
    for (const s of WorkflowScheduler.list()) {
      WorkflowScheduler.delete(s.id);
    }
  });

  describe("upsert", () => {
    it("creates a new schedule and returns it", () => {
      const s = WorkflowScheduler.upsert({
        name: "nightly",
        cron_expr: "0 2 * * *",
        stages: ["crawl-docs", "embed"],
        enabled: false,
      });
      expect(s.id).toBeDefined();
      expect(s.name).toBe("nightly");
      expect(s.stages).toEqual(["crawl-docs", "embed"]);
    });

    it("updates existing schedule by name (idempotent)", () => {
      const a = WorkflowScheduler.upsert({ name: "daily", cron_expr: "0 1 * * *", stages: ["embed"], enabled: false });
      const b = WorkflowScheduler.upsert({ name: "daily", cron_expr: "0 3 * * *", stages: ["embed", "normalise"], enabled: false });
      expect(a.id).toBe(b.id);
      expect(b.cron_expr).toBe("0 3 * * *");
    });

    it("includes created_at timestamp", () => {
      const s = WorkflowScheduler.upsert({ name: "ts-test", cron_expr: "0 2 * * *", stages: [], enabled: false });
      expect(s.created_at).toBeTruthy();
      expect(() => new Date(s.created_at)).not.toThrow();
    });
  });

  describe("delete", () => {
    it("returns true when schedule exists", () => {
      const s = WorkflowScheduler.upsert({ name: "del-test", cron_expr: "0 2 * * *", stages: [], enabled: false });
      expect(WorkflowScheduler.delete(s.id)).toBe(true);
    });

    it("returns false for unknown id", () => {
      expect(WorkflowScheduler.delete("not-a-real-id")).toBe(false);
    });

    it("removes schedule from list", () => {
      const s = WorkflowScheduler.upsert({ name: "gone", cron_expr: "0 2 * * *", stages: [], enabled: false });
      WorkflowScheduler.delete(s.id);
      expect(WorkflowScheduler.list().find(x => x.id === s.id)).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns empty array initially", () => {
      expect(WorkflowScheduler.list()).toEqual([]);
    });

    it("lists all created schedules", () => {
      WorkflowScheduler.upsert({ name: "s1", cron_expr: "0 2 * * *", stages: [], enabled: false });
      WorkflowScheduler.upsert({ name: "s2", cron_expr: "0 3 * * *", stages: [], enabled: false });
      expect(WorkflowScheduler.list()).toHaveLength(2);
    });
  });
});
