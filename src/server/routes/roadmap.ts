/**
 * Roadmap API Routes (roadmap-planning, tasks 3.1–3.3)
 *
 * GET  /api/roadmap/:projectKey                        — full RoadmapSnapshot
 * POST /api/roadmap/:projectKey/refresh                — trigger re-aggregation
 * GET  /api/roadmap/:projectKey/epics                  — all epics with scores
 * GET  /api/roadmap/:projectKey/epics/:epicKey         — epic detail
 * PATCH /api/roadmap/:projectKey/epics/:epicKey/rice   — human RICE override
 * GET  /api/roadmap/:projectKey/milestones             — all milestones
 * GET  /api/roadmap/:projectKey/dependencies           — DependencyEdge[]
 */

import { Hono } from "hono";
import type { RoadmapStore } from "../../stores/roadmap-store.js";
import type { RICEScore } from "../../types/roadmap.js";

export function createRoadmapRouter(store: RoadmapStore): Hono {
  const router = new Hono();

  const ok = (data: unknown) => ({ ok: true, data });
  const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

  // GET /api/roadmap/:projectKey
  router.get("/:projectKey", c => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot found. Try POST …/refresh"), 404);
    return c.json(ok(snap));
  });

  // POST /api/roadmap/:projectKey/refresh
  router.post("/:projectKey/refresh", async c => {
    const snap = await store.refresh(c.req.param("projectKey"));
    return c.json(ok(snap));
  });

  // GET /api/roadmap/:projectKey/epics
  router.get("/:projectKey/epics", c => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.epics));
  });

  // GET /api/roadmap/:projectKey/epics/:epicKey
  router.get("/:projectKey/epics/:epicKey", c => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    const epic = snap.epics.find(e => e.key === c.req.param("epicKey"));
    if (!epic) return c.json(err("NOT_FOUND", "Epic not found"), 404);
    return c.json(ok(epic));
  });

  // PATCH /api/roadmap/:projectKey/epics/:epicKey/rice
  router.patch("/:projectKey/epics/:epicKey/rice", async c => {
    const body = await c.req.json().catch(() => null) as Partial<RICEScore> | null;
    if (!body || typeof body !== "object") {
      return c.json(err("BAD_REQUEST", "Invalid JSON body"), 400);
    }
    const updated = await store.updateEpicRICE(c.req.param("epicKey"), body);
    if (!updated) return c.json(err("NOT_FOUND", "Epic not found"), 404);
    return c.json(ok(updated));
  });

  // GET /api/roadmap/:projectKey/milestones
  router.get("/:projectKey/milestones", c => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.milestones));
  });

  // GET /api/roadmap/:projectKey/dependencies
  router.get("/:projectKey/dependencies", c => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.dependency_graph));
  });

  return router;
}
