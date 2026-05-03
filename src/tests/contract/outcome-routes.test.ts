/**
 * Contract tests — Outcomes API routes (outcome-tracking task 7.7)
 *
 * Tests OKR CRUD, link epic, snapshot, notes patch, metric ingest.
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createOutcomesRouter } from "../../../server/routes/outcomes.js";
import type { OKRStore } from "../../../stores/okr-store.js";
import type { OutcomeSnapshotBuilder } from "../../../services/outcome-snapshot-builder.js";
import type { WebhookMetricsAdapter } from "../../../adapters/metrics/webhook.js";
import type { OKR, OutcomeSnapshot } from "../../../types/outcomes.js";

function makeOKR(id = "okr-1"): OKR {
  return {
    id,
    project_key: "PROJ",
    objective: "Improve retention",
    key_results: [
      { id: "kr-1", description: "MAU +10%", target: 10, current: 3, unit: "%", direction: "up", source: "manual" },
    ],
    linked_epic_keys: [],
    start_date: "2025-01-01",
    end_date: "2025-03-31",
    status: "active",
    created_at: new Date().toISOString(),
  };
}

function makeSnapshot(): OutcomeSnapshot {
  return {
    id: "snap-1",
    project_key: "PROJ",
    epic_key: "PROJ-100",
    generated_at: new Date().toISOString(),
    flag_adoptions: [],
    okr_deltas: [],
    reflection_draft: null,
    reflection_notes: null,
    status: "draft",
  };
}

function makeStore(): OKRStore {
  return {
    listOKRs: vi.fn().mockResolvedValue([makeOKR()]),
    getOKR: vi.fn().mockImplementation(async (id: string) => id === "okr-1" ? makeOKR() : null),
    createOKR: vi.fn().mockResolvedValue(makeOKR("okr-2")),
    linkEpicToOKR: vi.fn().mockResolvedValue({ ...makeOKR(), linked_epic_keys: ["PROJ-10"] }),
    latestSnapshot: vi.fn().mockResolvedValue(makeSnapshot()),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
    patchSnapshotNotes: vi.fn().mockResolvedValue({ ...makeSnapshot(), reflection_notes: "Great work", status: "reviewed" }),
    appendMetricEvent: vi.fn().mockResolvedValue({ id: "me-1" }),
    getMetricEvents: vi.fn().mockResolvedValue([]),
    updateKeyResult: vi.fn().mockResolvedValue(makeOKR()),
  } as unknown as OKRStore;
}

function makeApp(store: OKRStore): Hono {
  const builder: OutcomeSnapshotBuilder = { build: vi.fn().mockResolvedValue(makeSnapshot()) } as unknown as OutcomeSnapshotBuilder;
  const webhookMetrics: WebhookMetricsAdapter = { push: vi.fn() } as unknown as WebhookMetricsAdapter;
  const app = new Hono();
  app.route("/api/outcomes", createOutcomesRouter(store, builder, webhookMetrics));
  return app;
}

describe("Outcomes API contract tests", () => {
  it("GET /api/outcomes/:projectKey/okrs — returns list", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/okrs");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: OKR[] };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("POST /api/outcomes/:projectKey/okrs — creates OKR", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/okrs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objective: "Grow revenue",
        key_results: [{ description: "ARR +20%", target: 20, unit: "%", direction: "up" }],
        start_date: "2025-01-01",
        end_date: "2025-03-31",
      }),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/outcomes/:projectKey/okrs/:id — returns single OKR", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/okrs/okr-1");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: OKR };
    expect(body.data.id).toBe("okr-1");
  });

  it("GET /api/outcomes/:projectKey/okrs/:id — 404 for unknown", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/okrs/nope");
    expect(res.status).toBe(404);
  });

  it("POST /api/outcomes/:projectKey/okrs/:id/link-epic — links epic", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/okrs/okr-1/link-epic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epic_key: "PROJ-10" }),
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/outcomes/:projectKey/snapshot — returns latest snapshot", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/snapshot");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: OutcomeSnapshot };
    expect(body.data.project_key).toBe("PROJ");
  });

  it("PATCH /api/outcomes/:projectKey/snapshot/:id/notes — updates notes", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/PROJ/snapshot/snap-1/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Team did great" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: OutcomeSnapshot };
    expect(body.data.status).toBe("reviewed");
  });

  it("POST /api/outcomes/metrics/ingest — accepts metric event", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/outcomes/metrics/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric_name: "conversion_rate", value: 4.2, dimensions: { epic_key: "PROJ-1" } }),
    });
    expect(res.status).toBe(202);
  });
});
