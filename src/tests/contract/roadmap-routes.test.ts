/**
 * Contract tests — Roadmap API routes (roadmap-planning task 5.6)
 *
 * Tests all 7 routes with mocked RoadmapStore.
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createRoadmapRouter } from "../../server/routes/roadmap.js";
import type { RoadmapStore } from "../../../stores/roadmap-store.js";
import type { RoadmapSnapshot, Epic, Milestone, DependencyEdge } from "../../../types/roadmap.js";

function makeEpic(overrides: Partial<Epic> = {}): Epic {
  return {
    key: "PROJ-1",
    summary: "Epic One",
    project_key: "PROJ",
    status: "In Progress",
    health_score: 80,
    health_label: "healthy",
    child_keys: [],
    linked_epic_keys: [],
    milestone_id: null,
    rice_score: null,
    ice_score: null,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<RoadmapSnapshot> = {}): RoadmapSnapshot {
  const epic = makeEpic();
  return {
    project_key: "PROJ",
    generated_at: new Date().toISOString(),
    milestones: [],
    epics: [epic],
    dependency_graph: [],
    warnings: [],
    ...overrides,
  };
}

function makeStore(snap: RoadmapSnapshot | undefined): RoadmapStore {
  return {
    getSnapshot: vi.fn(() => snap),
    refresh: vi.fn().mockResolvedValue(snap ?? makeSnapshot()),
    getMilestones: vi.fn(() => snap?.milestones ?? []),
    updateEpicRICE: vi.fn().mockImplementation(async (epicKey: string, overrides: object) => {
      const epic = snap?.epics.find((e: Epic) => e.key === epicKey);
      if (!epic) return null;
      return { ...epic, rice_score: { ...overrides, score: 1000, estimated_by: "human" } };
    }),
  } as unknown as RoadmapStore;
}

function makeApp(store: RoadmapStore): Hono {
  const app = new Hono();
  app.route("/api/roadmap", createRoadmapRouter(store));
  return app;
}

describe("Roadmap API contract tests", () => {
  describe("GET /api/roadmap/:projectKey", () => {
    it("happy path — returns snapshot", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: RoadmapSnapshot };
      expect(body.ok).toBe(true);
      expect(body.data.project_key).toBe("PROJ");
    });

    it("no snapshot — 404", async () => {
      const app = makeApp(makeStore(undefined));
      const res = await app.request("/api/roadmap/NOPE");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/roadmap/:projectKey/refresh", () => {
    it("triggers refresh and returns new snapshot", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ/refresh", { method: "POST" });
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: RoadmapSnapshot };
      expect(body.ok).toBe(true);
    });
  });

  describe("GET /api/roadmap/:projectKey/epics", () => {
    it("returns epics array", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ/epics");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: Epic[] };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data[0].key).toBe("PROJ-1");
    });

    it("empty project — 404 when no snapshot", async () => {
      const app = makeApp(makeStore(undefined));
      const res = await app.request("/api/roadmap/EMPTY/epics");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/roadmap/:projectKey/epics/:epicKey", () => {
    it("returns single epic", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ/epics/PROJ-1");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: Epic };
      expect(body.data.key).toBe("PROJ-1");
    });

    it("unknown epic — 404", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ/epics/PROJ-999");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/roadmap/:projectKey/epics/:epicKey/rice", () => {
    it("valid override — returns updated epic", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ/epics/PROJ-1/rice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reach: 500, impact: 2, confidence: 75, effort: 3 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: Epic };
      expect(body.ok).toBe(true);
      expect(body.data.rice_score).not.toBeNull();
    });

    it("invalid body — 400", async () => {
      const app = makeApp(makeStore(makeSnapshot()));
      const res = await app.request("/api/roadmap/PROJ/epics/PROJ-1/rice", {
        method: "PATCH",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/roadmap/:projectKey/milestones", () => {
    it("returns milestones", async () => {
      const ms: Milestone = { id: "v1", name: "v1.0", target_date: "2025-06-01", quarter: "Q2-2025", project_key: "PROJ", epic_keys: [], status: "planned" };
      const app = makeApp(makeStore(makeSnapshot({ milestones: [ms] })));
      const res = await app.request("/api/roadmap/PROJ/milestones");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: Milestone[] };
      expect(body.data).toHaveLength(1);
    });
  });

  describe("GET /api/roadmap/:projectKey/dependencies", () => {
    it("returns dependency edges (with cycle warning in snapshot)", async () => {
      const edge: DependencyEdge = { from_epic: "PROJ-1", to_epic: "PROJ-2", type: "depends-on", cross_team: false };
      const snap = makeSnapshot({ dependency_graph: [edge], warnings: ["cycle:PROJ-1->PROJ-2->PROJ-1"] });
      const app = makeApp(makeStore(snap));
      const res = await app.request("/api/roadmap/PROJ/dependencies");
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean; data: DependencyEdge[] };
      expect(body.data).toHaveLength(1);
      // cycle warning is in the snapshot itself, accessible via GET /:projectKey
      const snapStore = makeStore(snap);
      const body2 = await makeApp(snapStore).request("/api/roadmap/PROJ");
      const snap3 = await body2.json() as { ok: boolean; data: RoadmapSnapshot };
      expect(snap3.data.warnings.some((w: string) => w.startsWith("cycle:"))).toBe(true);
    });
  });
});
