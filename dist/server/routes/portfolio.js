/**
 * Portfolio API Routes (portfolio-management task 3.1)
 *
 * GET  /api/portfolio                                  — list portfolios
 * POST /api/portfolio                                  — create portfolio
 * GET  /api/portfolio/:id                              — get portfolio
 * POST /api/portfolio/:id/projects                     — add project
 * GET  /api/portfolio/:id/snapshot                     — latest snapshot
 * POST /api/portfolio/:id/snapshot/refresh             — rebuild snapshot
 * GET  /api/portfolio/:id/dependencies                 — cross-project edges
 * GET  /api/portfolio/:id/capacity                     — capacity heatmap rows
 * GET  /api/portfolio/:id/digest                       — latest digest markdown
 * POST /api/portfolio/:id/digest/generate              — generate new digest
 * POST /api/portfolio/:id/digest/deliver/slack         — deliver to Slack
 * POST /api/portfolio/:id/digest/deliver/confluence    — deliver to Confluence
 */
import { Hono } from "hono";
export function createPortfolioRouter(store, aggregator, digestWriter) {
    const router = new Hono();
    const ok = (data) => ({ ok: true, data });
    const err = (code, message) => ({ ok: false, error: { code, message } });
    // GET /api/portfolio
    router.get("/", async (c) => {
        return c.json(ok(await store.listPortfolios()));
    });
    // POST /api/portfolio
    router.post("/", async (c) => {
        const body = await c.req.json();
        const portfolio = await store.createPortfolio({ name: body.name, project_keys: body.project_keys ?? [], owner: body.owner ?? null });
        return c.json(ok(portfolio), 201);
    });
    // GET /api/portfolio/:id
    router.get("/:id", async (c) => {
        const p = await store.getPortfolio(c.req.param("id"));
        if (!p)
            return c.json(err("NOT_FOUND", "Portfolio not found"), 404);
        return c.json(ok(p));
    });
    // POST /api/portfolio/:id/projects
    router.post("/:id/projects", async (c) => {
        const { project_key } = await c.req.json();
        try {
            const updated = await store.addProjectToPortfolio(c.req.param("id"), project_key);
            return c.json(ok(updated));
        }
        catch (e) {
            return c.json(err("UPDATE_FAILED", e instanceof Error ? e.message : String(e)), 400);
        }
    });
    // GET /api/portfolio/:id/snapshot
    router.get("/:id/snapshot", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap)
            return c.json(err("NOT_FOUND", "No snapshot yet. Try POST …/snapshot/refresh"), 404);
        return c.json(ok(snap));
    });
    // POST /api/portfolio/:id/snapshot/refresh
    router.post("/:id/snapshot/refresh", async (c) => {
        try {
            const snap = await aggregator.aggregate(c.req.param("id"));
            return c.json(ok(snap));
        }
        catch (e) {
            return c.json(err("AGGREGATE_FAILED", e instanceof Error ? e.message : String(e)), 500);
        }
    });
    // GET /api/portfolio/:id/dependencies
    router.get("/:id/dependencies", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap)
            return c.json(err("NOT_FOUND", "No snapshot"), 404);
        return c.json(ok(snap.dependencies));
    });
    // GET /api/portfolio/:id/capacity
    router.get("/:id/capacity", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap)
            return c.json(err("NOT_FOUND", "No snapshot"), 404);
        return c.json(ok(snap.capacity_rows));
    });
    // GET /api/portfolio/:id/digest
    router.get("/:id/digest", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap?.digest)
            return c.json(err("NOT_FOUND", "No digest yet. Try POST …/digest/generate"), 404);
        return c.json(ok(snap.digest));
    });
    // POST /api/portfolio/:id/digest/generate
    router.post("/:id/digest/generate", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap)
            return c.json(err("NOT_FOUND", "No snapshot. Refresh first."), 404);
        try {
            const digest = await digestWriter.generate(snap);
            // Persist digest back onto snapshot
            const updated = { ...snap, digest };
            await store.saveSnapshot(updated);
            return c.json(ok(digest));
        }
        catch (e) {
            return c.json(err("GENERATE_FAILED", e instanceof Error ? e.message : String(e)), 500);
        }
    });
    // POST /api/portfolio/:id/digest/deliver/slack
    router.post("/:id/digest/deliver/slack", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap?.digest)
            return c.json(err("NOT_FOUND", "No digest. Generate first."), 404);
        const record = await digestWriter.deliverToSlack(snap.digest);
        return c.json(ok(record));
    });
    // POST /api/portfolio/:id/digest/deliver/confluence
    router.post("/:id/digest/deliver/confluence", async (c) => {
        const snap = await store.latestSnapshot(c.req.param("id"));
        if (!snap?.digest)
            return c.json(err("NOT_FOUND", "No digest. Generate first."), 404);
        const record = await digestWriter.deliverToConfluence(snap.digest);
        return c.json(ok(record));
    });
    return router;
}
