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
import type { DocumentType } from "../../types/prd.js";

export function createPRDRouter(
  store: DraftStore,
  writer: PRDWriter,
  publisher: ConfluencePublisher | null,
): Hono {
  const router = new Hono();
  const ok = (data: unknown) => ({ ok: true, data });
  const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

  // GET /api/prd/:projectKey/drafts
  router.get("/:projectKey/drafts", async (c) => {
    return c.json(ok(await store.listDrafts(c.req.param("projectKey"))));
  });

  // POST /api/prd/:projectKey/drafts/generate
  router.post("/:projectKey/drafts/generate", async (c) => {
    const body = await c.req.json<{ epic_key?: string; document_type?: DocumentType; context: string }>();
    try {
      const draft = await writer.generate({
        project_key:   c.req.param("projectKey"),
        epic_key:      body.epic_key ?? null,
        document_type: body.document_type ?? "prd",
        context:       body.context,
      });
      return c.json(ok(draft), 201);
    } catch (e) {
      return c.json(err("GENERATE_FAILED", e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // GET /api/prd/:projectKey/drafts/:id
  router.get("/:projectKey/drafts/:id", async (c) => {
    const draft = await store.getDraft(c.req.param("id"));
    if (!draft) return c.json(err("NOT_FOUND", "Draft not found"), 404);
    return c.json(ok(draft));
  });

  // GET /api/prd/:projectKey/drafts/:id/diff
  router.get("/:projectKey/drafts/:id/diff", async (c) => {
    const draft = await store.getDraft(c.req.param("id"));
    if (!draft) return c.json(err("NOT_FOUND", "Draft not found"), 404);
    if (!draft.confluence_url) return c.json(ok({ before: "", after: "" }));
    // For already-published drafts we don't re-fetch; return empty diff signal
    return c.json(ok({ before: "", after: "(already published)" }));
  });

  // POST /api/prd/:projectKey/drafts/:id/approve
  router.post("/:projectKey/drafts/:id/approve", async (c) => {
    try {
      const draft = await store.approve(c.req.param("id"));
      return c.json(ok(draft));
    } catch (e) {
      return c.json(err("APPROVE_FAILED", e instanceof Error ? e.message : String(e)), 400);
    }
  });

  // POST /api/prd/:projectKey/drafts/:id/publish
  router.post("/:projectKey/drafts/:id/publish", async (c) => {
    const draft = await store.getDraft(c.req.param("id"));
    if (!draft) return c.json(err("NOT_FOUND", "Draft not found"), 404);
    if (draft.status !== "approved") {
      return c.json(err("NOT_APPROVED", "Draft must be approved before publishing"), 403);
    }
    if (!publisher) {
      return c.json(err("NOT_CONFIGURED", "Confluence publisher not configured"), 503);
    }
    try {
      const { url, diff } = await publisher.publish(draft);
      const published = await store.markPublished(draft.id, url);
      return c.json(ok({ draft: published, diff }));
    } catch (e) {
      return c.json(err("PUBLISH_FAILED", e instanceof Error ? e.message : String(e)), 500);
    }
  });

  return router;
}
