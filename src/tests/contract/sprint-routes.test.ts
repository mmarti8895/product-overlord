/**
 * Contract tests — Sprint API routes (task 5.6)
 *
 * Tests all 4 routes:
 *   - GET /api/sprint/:boardId/snapshot  — happy path, stale cache, no data (null)
 *   - GET /api/sprint/:boardId/velocity  — happy path
 *   - GET /api/sprint/:boardId/blockers  — happy path
 *   - GET /api/sprint/stream             — SSE content-type
 *   - Missing boardId equivalent (unknown board → null data)
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createSprintRouter } from "../../../server/routes/sprint.js";
import type { SprintMonitor } from "../../../services/sprint-monitor.js";
import type { SprintSnapshot } from "../../../types/sprint.js";

function makeSnapshot(overrides: Partial<SprintSnapshot> = {}): SprintSnapshot {
  return {
    board_id: "1",
    sprint_id: "101",
    sprint_name: "Sprint 1",
    fetched_at: new Date().toISOString(),
    start_date: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    end_date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    days_remaining: 7,
    committed_points: 20,
    completed_points: 12,
    points_estimated_from_time: false,
    velocity_trend: [{ sprint_id: "99", sprint_name: "Sprint 0", committed: 18, completed: 15 }],
    blockers: [{ key: "BLK-1", summary: "A blocker", blocker_keys: ["EXT-5"], age_days: 3 }],
    scope_additions: [],
    scope_creep_delta: 0,
    health_score: 70,
    health_label: "at-risk",
    stale: false,
    warnings: [],
    ...overrides,
  };
}

function makeMonitor(snaps: Record<string, SprintSnapshot | undefined>): SprintMonitor {
  return {
    getSnapshot: vi.fn((id: string) => snaps[id]),
    getAllSnapshots: vi.fn(() => Object.values(snaps).filter(Boolean) as SprintSnapshot[]),
  } as unknown as SprintMonitor;
}

function makeApp(monitor: SprintMonitor): Hono {
  const app = new Hono();
  app.route("/api/sprint", createSprintRouter(monitor));
  return app;
}

describe("Sprint API contract tests", () => {
  // ── Snapshot ────────────────────────────────────────────────────────────
  describe("GET /api/sprint/:boardId/snapshot", () => {
    it("happy path — returns snapshot with ok:true", async () => {
      const app = makeApp(makeMonitor({ "1": makeSnapshot() }));
      const res = await app.request("/api/sprint/1/snapshot");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: SprintSnapshot };
      expect(body.ok).toBe(true);
      expect(body.data.sprint_id).toBe("101");
    });

    it("stale cache — stale flag is forwarded", async () => {
      const app = makeApp(makeMonitor({ "1": makeSnapshot({ stale: true, stale_since: new Date().toISOString() }) }));
      const res = await app.request("/api/sprint/1/snapshot");
      const body = await res.json() as { ok: boolean; data: SprintSnapshot };
      expect(body.data.stale).toBe(true);
    });

    it("no active sprint — returns ok:true with null data", async () => {
      const app = makeApp(makeMonitor({}));
      const res = await app.request("/api/sprint/999/snapshot");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: null };
      expect(body.ok).toBe(true);
      expect(body.data).toBeNull();
    });
  });

  // ── Velocity ────────────────────────────────────────────────────────────
  describe("GET /api/sprint/:boardId/velocity", () => {
    it("returns velocity_trend array", async () => {
      const app = makeApp(makeMonitor({ "1": makeSnapshot() }));
      const res = await app.request("/api/sprint/1/velocity");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: unknown[] };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it("returns empty array when no snapshot", async () => {
      const app = makeApp(makeMonitor({}));
      const res = await app.request("/api/sprint/99/velocity");
      const body = await res.json() as { ok: boolean; data: unknown[] };
      expect(body.data).toEqual([]);
    });
  });

  // ── Blockers ────────────────────────────────────────────────────────────
  describe("GET /api/sprint/:boardId/blockers", () => {
    it("returns blockers array", async () => {
      const app = makeApp(makeMonitor({ "1": makeSnapshot() }));
      const res = await app.request("/api/sprint/1/blockers");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: unknown[] };
      expect(body.data).toHaveLength(1);
    });

    it("returns empty array when no snapshot", async () => {
      const app = makeApp(makeMonitor({}));
      const res = await app.request("/api/sprint/99/blockers");
      const body = await res.json() as { ok: boolean; data: unknown[] };
      expect(body.data).toEqual([]);
    });
  });

  // ── SSE stream ──────────────────────────────────────────────────────────
  describe("GET /api/sprint/stream", () => {
    it("returns text/event-stream content-type", async () => {
      const app = makeApp(makeMonitor({}));
      const res = await app.request("/api/sprint/stream");
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    });
  });
});
