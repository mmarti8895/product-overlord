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
export declare function createOutcomesRouter(store: OKRStore, builder: OutcomeSnapshotBuilder, webhookMetrics: WebhookMetricsAdapter): Hono;
