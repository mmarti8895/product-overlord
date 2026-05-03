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
export declare function createSprintRouter(monitor: SprintMonitor): Hono;
