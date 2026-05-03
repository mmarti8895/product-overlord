/**
 * Outcomes API Routes (outcome-tracking task 3.1)
 *
 * GET  /api/outcomes/:projectKey/okrs                     — list OKRs
 * POST /api/outcomes/:projectKey/okrs                     — create OKR
 * GET  /api/outcomes/:projectKey/okrs/:id                 — get OKR
 * POST /api/outcomes/:projectKey/okrs/:id/link-epic        — link epic key
 * GET  /api/outcomes/:projectKey/snapshot                  — latest snapshot
 * POST /api/outcomes/:projectKey/snapshot/refresh          — rebuild snapshot
 * PATCH /api/outcomes/:projectKey/snapshot/:id/notes       — update notes
 * POST /api/outcomes/metrics/ingest                        — webhook metric push
 */

import { Hono } from "hono";
import type { OKRStore } from "../../stores/okr-store.js";
import type { OutcomeSnapshotBuilder } from "../../services/outcome-snapshot-builder.js";
import type { WebhookMetricsAdapter } from "../../adapters/metrics/webhook.js";

export function createOutcomesRouter(
  store: OKRStore,
  builder: OutcomeSnapshotBuilder,
  webhookMetrics: WebhookMetricsAdapter,
): Hono {
  const router = new Hono();
  const ok = (data: unknown) => ({ ok: true, data });
  const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

  // GET /api/outcomes/:projectKey/okrs
  router.get("/:projectKey/okrs", async (c) => {
    const okrs = await store.listOKRs(c.req.param("projectKey"));
    return c.json(ok(okrs));
  });

  // POST /api/outcomes/:projectKey/okrs
  router.post("/:projectKey/okrs", async (c) => {
    const body = await c.req.json<{
      objective: string;
      key_results: { description: string; target: number; unit: string; direction?: "up" | "down" }[];
      start_date: string;
      end_date: string;
    }>();
    const projectKey = c.req.param("projectKey");
    const okr = await store.createOKR({
      project_key:  projectKey,
      objective:    body.objective,
      key_results:  body.key_results.map((kr) =>
        store.newKeyResult({ okr_id: "", description: kr.description, target: kr.target, current: 0, unit: kr.unit, direction: kr.direction ?? "up" }),
      ),
      epic_keys:    [],
      start_date:   body.start_date,
      end_date:     body.end_date,
    });
    return c.json(ok(okr), 201);
  });

  // GET /api/outcomes/:projectKey/okrs/:id
  router.get("/:projectKey/okrs/:id", async (c) => {
    const okr = await store.getOKR(c.req.param("id"));
    if (!okr) return c.json(err("NOT_FOUND", "OKR not found"), 404);
    return c.json(ok(okr));
  });

  // POST /api/outcomes/:projectKey/okrs/:id/link-epic
  router.post("/:projectKey/okrs/:id/link-epic", async (c) => {
    const { epic_key } = await c.req.json<{ epic_key: string }>();
    try {
      const updated = await store.linkEpicToOKR(c.req.param("id"), epic_key);
      return c.json(ok(updated));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("LINK_FAILED", msg), 400);
    }
  });

  // GET /api/outcomes/:projectKey/snapshot
  router.get("/:projectKey/snapshot", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot yet. Try POST …/snapshot/refresh"), 404);
    return c.json(ok(snap));
  });

  // POST /api/outcomes/:projectKey/snapshot/refresh
  router.post("/:projectKey/snapshot/refresh", async (c) => {
    try {
      const snap = await builder.build(c.req.param("projectKey"));
      return c.json(ok(snap));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("BUILD_FAILED", msg), 500);
    }
  });

  // PATCH /api/outcomes/:projectKey/snapshot/:id/notes
  router.patch("/:projectKey/snapshot/:id/notes", async (c) => {
    const { notes } = await c.req.json<{ notes: string }>();
    const updated = await store.patchSnapshotNotes(c.req.param("id"), notes);
    if (!updated) return c.json(err("NOT_FOUND", "Snapshot not found"), 404);
    return c.json(ok(updated));
  });

  // POST /api/outcomes/metrics/ingest
  router.post("/metrics/ingest", async (c) => {
    const body = await c.req.json<{
      metric_name: string;
      value: number;
      occurred_at?: number;
      flag_key?: string;
      okr_id?: string;
      kr_id?: string;
    }>();
    webhookMetrics.push({
      source:       "webhook",
      metric_name:  body.metric_name,
      value:        body.value,
      occurred_at:  body.occurred_at ?? Date.now(),
      flag_key:     body.flag_key,
      okr_id:       body.okr_id,
      kr_id:        body.kr_id,
    });
    return c.json(ok({ queued: true }));
  });

  return router;
}
