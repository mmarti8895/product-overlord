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
export declare function createRoadmapRouter(store: RoadmapStore): Hono;
