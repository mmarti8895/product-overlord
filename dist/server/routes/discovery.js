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
export function createDiscoveryRouter(queue, clusterer, sizer, adapters, webhookAdapter) {
    const router = new Hono();
    const ok = (data) => ({ ok: true, data });
    const err = (code, message) => ({ ok: false, error: { code, message } });
    // POST /api/discovery/sync
    router.post("/sync", async (c) => {
        try {
            const since = await queue.getLatestDocumentDate();
            for (const adapter of adapters) {
                const raw = await adapter.fetchSince(since);
                await queue.ingestRaw(raw.map((r) => ({ ...r, source: adapter.source })));
            }
            const docs = await queue.getDocuments();
            if (docs.length > 0) {
                const themes = await clusterer.cluster(docs);
                await queue.upsertThemes(themes);
                const candidates = await Promise.all(themes.map((t) => sizer.size(t)));
                await queue.upsertCandidates(candidates);
            }
            return c.json(ok({ message: "sync complete", document_count: docs.length }));
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return c.json(err("SYNC_FAILED", msg), 500);
        }
    });
    // POST /api/discovery/ingest
    router.post("/ingest", async (c) => {
        const body = await c.req.json();
        webhookAdapter.push({
            source_id: body.source_id,
            text: body.text,
            created_at: body.created_at ?? Date.now(),
            customer_segment: body.customer_segment ?? null,
            tags: body.tags ?? [],
        });
        return c.json(ok({ queued: true }));
    });
    // GET /api/discovery/documents
    router.get("/documents", async (c) => {
        const docs = await queue.getDocuments();
        return c.json(ok(docs));
    });
    // GET /api/discovery/themes
    router.get("/themes", async (c) => {
        const themes = await queue.getThemes();
        return c.json(ok(themes));
    });
    // GET /api/discovery/themes/:id
    router.get("/themes/:id", async (c) => {
        const theme = await queue.getTheme(c.req.param("id"));
        if (!theme)
            return c.json(err("NOT_FOUND", "Theme not found"), 404);
        return c.json(ok(theme));
    });
    // GET /api/discovery/candidates
    router.get("/candidates", async (c) => {
        const candidates = await queue.getCandidates();
        return c.json(ok(candidates));
    });
    // GET /api/discovery/candidates/:id
    router.get("/candidates/:id", async (c) => {
        const candidate = await queue.getCandidate(c.req.param("id"));
        if (!candidate)
            return c.json(err("NOT_FOUND", "Candidate not found"), 404);
        return c.json(ok(candidate));
    });
    // POST /api/discovery/candidates/:id/promote
    router.post("/candidates/:id/promote", async (c) => {
        const body = await c.req.json();
        try {
            const updated = await queue.promote(c.req.param("id"), body);
            return c.json(ok(updated));
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return c.json(err("PROMOTE_FAILED", msg), 400);
        }
    });
    // POST /api/discovery/candidates/:id/dismiss
    router.post("/candidates/:id/dismiss", async (c) => {
        const body = await c.req.json();
        try {
            const updated = await queue.dismiss(c.req.param("id"), body.reason ?? "");
            return c.json(ok(updated));
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return c.json(err("DISMISS_FAILED", msg), 400);
        }
    });
    return router;
}
