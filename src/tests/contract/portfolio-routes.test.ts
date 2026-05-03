/**
 * Contract tests — Portfolio API routes (portfolio-management task 7.6)
 *
 * Tests all 12 routes with mocked store/aggregator/digestWriter.
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createPortfolioRouter } from "../../../server/routes/portfolio.js";
import type { PortfolioStore } from "../../../stores/portfolio-store.js";
import type { PortfolioAggregator } from "../../../services/portfolio-aggregator.js";
import type { PortfolioDigestWriter } from "../../../services/portfolio-digest.js";
import type { Portfolio, PortfolioSnapshot, PortfolioDigest, DeliveryRecord } from "../../../types/portfolio.js";

function makePortfolio(id = "p1"): Portfolio {
  return { id, name: "My Portfolio", project_keys: ["PROJ", "ALPHA"], owner: null, created_at: new Date().toISOString() };
}

function makeDigest(): PortfolioDigest {
  return { portfolio_id: "p1", generated_at: new Date().toISOString(), markdown: "# Summary", projects: [] };
}

function makeSnapshot(withDigest = false): PortfolioSnapshot {
  return {
    portfolio_id: "p1",
    generated_at: new Date().toISOString(),
    projects: [],
    dependencies: [],
    capacity_rows: [],
    warnings: [],
    ...(withDigest ? { digest: makeDigest() } : {}),
  };
}

function makeDelivery(): DeliveryRecord {
  return { id: "d1", portfolio_id: "p1", channel: "slack", delivered_at: new Date().toISOString(), success: true, error: null };
}

function makeStore(snap?: PortfolioSnapshot): PortfolioStore {
  return {
    listPortfolios: vi.fn().mockResolvedValue([makePortfolio()]),
    getPortfolio: vi.fn().mockImplementation(async (id: string) => id === "p1" ? makePortfolio() : null),
    createPortfolio: vi.fn().mockResolvedValue(makePortfolio("p2")),
    addProjectToPortfolio: vi.fn().mockResolvedValue({ ...makePortfolio(), project_keys: ["PROJ", "ALPHA", "NEW"] }),
    latestSnapshot: vi.fn().mockResolvedValue(snap ?? null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
  } as unknown as PortfolioStore;
}

function makeApp(store: PortfolioStore, snapForDigest = false): Hono {
  const aggregator: PortfolioAggregator = { aggregate: vi.fn().mockResolvedValue(makeSnapshot()) } as unknown as PortfolioAggregator;
  const digestWriter: PortfolioDigestWriter = {
    generate: vi.fn().mockResolvedValue(makeDigest()),
    deliverToSlack: vi.fn().mockResolvedValue(makeDelivery()),
    deliverToConfluence: vi.fn().mockResolvedValue({ ...makeDelivery(), channel: "confluence" }),
  } as unknown as PortfolioDigestWriter;
  const app = new Hono();
  app.route("/api/portfolio", createPortfolioRouter(store, aggregator, digestWriter));
  return app;
}

describe("Portfolio API contract tests", () => {
  it("GET /api/portfolio — returns list", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/portfolio");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: Portfolio[] };
    expect(body.data).toHaveLength(1);
  });

  it("POST /api/portfolio — creates portfolio", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Portfolio", project_keys: ["ABC"] }),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/portfolio/:id — returns portfolio", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/portfolio/p1");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: Portfolio };
    expect(body.data.name).toBe("My Portfolio");
  });

  it("GET /api/portfolio/:id — 404 for unknown", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/portfolio/nope");
    expect(res.status).toBe(404);
  });

  it("POST /api/portfolio/:id/projects — adds project", async () => {
    const app = makeApp(makeStore(makeSnapshot()));
    const res = await app.request("/api/portfolio/p1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_key: "NEW" }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/portfolio/:id/snapshot — returns snapshot", async () => {
    const app = makeApp(makeStore(makeSnapshot()));
    const res = await app.request("/api/portfolio/p1/snapshot");
    expect(res.status).toBe(200);
  });

  it("GET /api/portfolio/:id/snapshot — 404 when no snapshot", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/portfolio/p1/snapshot");
    expect(res.status).toBe(404);
  });

  it("POST /api/portfolio/:id/snapshot/refresh — triggers aggregation", async () => {
    const app = makeApp(makeStore(makeSnapshot()));
    const res = await app.request("/api/portfolio/p1/snapshot/refresh", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("GET /api/portfolio/:id/dependencies — returns deps", async () => {
    const app = makeApp(makeStore(makeSnapshot()));
    const res = await app.request("/api/portfolio/p1/dependencies");
    expect(res.status).toBe(200);
  });

  it("GET /api/portfolio/:id/capacity — returns capacity rows", async () => {
    const app = makeApp(makeStore(makeSnapshot()));
    const res = await app.request("/api/portfolio/p1/capacity");
    expect(res.status).toBe(200);
  });

  it("POST /api/portfolio/:id/digest/generate — generates digest", async () => {
    const app = makeApp(makeStore(makeSnapshot(false)));
    const res = await app.request("/api/portfolio/p1/digest/generate", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: PortfolioDigest };
    expect(body.data.markdown).toBe("# Summary");
  });

  it("POST /api/portfolio/:id/digest/deliver/slack — delivers to Slack", async () => {
    const app = makeApp(makeStore(makeSnapshot(true)));
    const res = await app.request("/api/portfolio/p1/digest/deliver/slack", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: DeliveryRecord };
    expect(body.data.channel).toBe("slack");
  });

  it("missing project data — warnings present in snapshot", async () => {
    const snap = { ...makeSnapshot(), warnings: ["missing_roadmap:PROJ"] };
    const app = makeApp(makeStore(snap));
    const res = await app.request("/api/portfolio/p1/snapshot");
    const body = await res.json() as { ok: boolean; data: PortfolioSnapshot };
    expect(body.data.warnings).toContain("missing_roadmap:PROJ");
  });
});
