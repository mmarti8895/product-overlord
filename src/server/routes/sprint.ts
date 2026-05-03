/**
 * Sprint API Routes (tasks 3.1, 3.3)
 *
 * GET /api/sprint/:boardId/snapshot  — latest SprintSnapshot for a board
 * GET /api/sprint/:boardId/velocity  — VelocityPoint[] for last 6 sprints
 * GET /api/sprint/:boardId/blockers  — BlockerTicket[] for active sprint
 * GET /api/sprint/stream             — SSE stream of sprint:snapshot-updated events
 *
 * All JSON routes return { ok: true, data } | { ok: false, error: { code, message } }.
 * SSE emits `sprint:heartbeat` every 30 s and `sprint:snapshot-updated` on each poll.
 */

import { Hono } from "hono";
import type { SprintMonitor } from "../../services/sprint-monitor.js";
import { AgentEventBus } from "../../agents/AgentEventBus.js";
import { logger } from "../../utils/logger.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function createSprintRouter(monitor: SprintMonitor): Hono {
  const router = new Hono();

  // ── GET /api/sprint/:boardId/snapshot ──────────────────────────────────
  router.get("/:boardId/snapshot", (c) => {
    const boardId = c.req.param("boardId");
    if (!boardId) {
      return c.json({ ok: false, error: { code: "MISSING_BOARD_ID", message: "boardId is required" } }, 400);
    }
    const snap = monitor.getSnapshot(boardId);
    if (snap === undefined) {
      return c.json({ ok: true, data: null }, 200);
    }
    return c.json({ ok: true, data: snap }, 200);
  });

  // ── GET /api/sprint/:boardId/velocity ──────────────────────────────────
  router.get("/:boardId/velocity", (c) => {
    const boardId = c.req.param("boardId");
    if (!boardId) {
      return c.json({ ok: false, error: { code: "MISSING_BOARD_ID", message: "boardId is required" } }, 400);
    }
    const snap = monitor.getSnapshot(boardId);
    if (!snap) {
      return c.json({ ok: true, data: [] }, 200);
    }
    return c.json({ ok: true, data: snap.velocity_trend }, 200);
  });

  // ── GET /api/sprint/:boardId/blockers ──────────────────────────────────
  router.get("/:boardId/blockers", (c) => {
    const boardId = c.req.param("boardId");
    if (!boardId) {
      return c.json({ ok: false, error: { code: "MISSING_BOARD_ID", message: "boardId is required" } }, 400);
    }
    const snap = monitor.getSnapshot(boardId);
    if (!snap) {
      return c.json({ ok: true, data: [] }, 200);
    }
    return c.json({ ok: true, data: snap.blockers }, 200);
  });

  // ── GET /api/sprint/stream (SSE) ───────────────────────────────────────
  // Note: this route MUST be registered BEFORE /:boardId/* so Hono matches it first.
  router.get("/stream", (c) => {
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    function send(eventName: string, data: unknown) {
      const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
      writer.write(encoder.encode(payload)).catch(() => cleanup());
    }

    // Replay recent sprint snapshots to the new client
    for (const snap of monitor.getAllSnapshots()) {
      send("sprint:snapshot-updated", snap);
    }

    // Subscribe to live updates
    const unsub = AgentEventBus.subscribe((evt) => {
      if (
        evt.event === "finding" &&
        evt.agent === "sprint-monitor" &&
        typeof evt.message === "string" &&
        evt.message.startsWith("sprint:snapshot-updated:")
      ) {
        const boardId = evt.message.replace("sprint:snapshot-updated:", "");
        const snap = monitor.getSnapshot(boardId);
        if (snap) send("sprint:snapshot-updated", snap);
      }
    });

    // Heartbeat every 30 s
    const heartbeat = setInterval(() => {
      send("sprint:heartbeat", { ts: new Date().toISOString() });
    }, HEARTBEAT_INTERVAL_MS);

    function cleanup() {
      unsub();
      clearInterval(heartbeat);
      writer.close().catch(() => {});
      logger.info("sprint_sse_client_disconnected", {});
    }

    // Detect client disconnect via the request abort signal
    c.req.raw.signal?.addEventListener("abort", cleanup, { once: true });

    return new Response(readable as unknown as BodyInit, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  return router;
}
