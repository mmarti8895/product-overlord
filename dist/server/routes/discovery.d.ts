/**
 * Discovery-intake API Routes (task 3.1)
 *
 * POST /api/discovery/sync                        — trigger full ingest + cluster
 * POST /api/discovery/ingest                      — webhook push of a single item
 * GET  /api/discovery/documents                   — list feedback documents
 * GET  /api/discovery/themes                      — list all themes
 * GET  /api/discovery/themes/:id                  — single theme detail
 * GET  /api/discovery/candidates                  — list opportunity candidates
 * GET  /api/discovery/candidates/:id              — single candidate
 * POST /api/discovery/candidates/:id/promote      — promote to Jira
 * POST /api/discovery/candidates/:id/dismiss      — dismiss with reason
 */
import { Hono } from "hono";
import type { TriageQueue } from "../../stores/triage-queue.js";
import type { ThemeClusterer } from "../../services/theme-clusterer.js";
import type { OpportunitySizer } from "../../services/opportunity-sizer.js";
import type { FeedbackAdapter } from "../../adapters/feedback/index.js";
import type { WebhookFeedbackAdapter } from "../../adapters/feedback/webhook.js";
export declare function createDiscoveryRouter(queue: TriageQueue, clusterer: ThemeClusterer, sizer: OpportunitySizer, adapters: FeedbackAdapter[], webhookAdapter: WebhookFeedbackAdapter): Hono;
