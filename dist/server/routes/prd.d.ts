/**
 * PRD API Routes (prd-generation task 3.1)
 *
 * GET  /api/prd/:projectKey/drafts                     — list drafts
 * POST /api/prd/:projectKey/drafts/generate            — generate new draft
 * GET  /api/prd/:projectKey/drafts/:id                 — get draft
 * GET  /api/prd/:projectKey/drafts/:id/diff            — get Confluence diff
 * POST /api/prd/:projectKey/drafts/:id/approve         — approve (gate on publish)
 * POST /api/prd/:projectKey/drafts/:id/publish         — publish to Confluence (requires approved)
 */
import { Hono } from "hono";
import type { DraftStore } from "../../stores/draft-store.js";
import type { PRDWriter } from "../../services/prd-writer.js";
import type { ConfluencePublisher } from "../../services/confluence-publisher.js";
export declare function createPRDRouter(store: DraftStore, writer: PRDWriter, publisher: ConfluencePublisher | null): Hono;
