/**
 * Contract tests — PRD API routes (prd-generation task 5.5)
 *
 * Tests all 7 routes: list, generate, get, diff, approve, publish (+ guards).
 */

import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createPRDRouter } from "../../../server/routes/prd.js";
import type { DraftStore } from "../../../stores/draft-store.js";
import type { PRDWriter } from "../../../services/prd-writer.js";
import type { PRDDraft } from "../../../types/prd.js";

function makeDraft(overrides: Partial<PRDDraft> = {}): PRDDraft {
  return {
    id: "draft-1",
    project_key: "PROJ",
    epic_key: "PROJ-100",
    document_type: "prd",
    version: 1,
    title: "My PRD",
    content: { sections: [{ id: "s1", heading: "Overview", body: "Build X.", order: 1 }], rag_sources: [] },
    status: "draft",
    confluence_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeStore(draft: PRDDraft | null = makeDraft()): DraftStore {
  return {
    listDrafts: vi.fn().mockResolvedValue(draft ? [draft] : []),
    getDraft: vi.fn().mockImplementation(async (id: string) => id === "draft-1" ? draft : null),
    saveDraft: vi.fn().mockResolvedValue(draft ?? makeDraft()),
    approve: vi.fn().mockResolvedValue({ ...(draft ?? makeDraft()), status: "approved" }),
    markPublished: vi.fn().mockResolvedValue({ ...(draft ?? makeDraft()), status: "published", confluence_url: "https://wiki/p1" }),
  } as unknown as DraftStore;
}

function makeWriter(): PRDWriter {
  return {
    generate: vi.fn().mockResolvedValue(makeDraft()),
  } as unknown as PRDWriter;
}

function makeApp(store: DraftStore, writer: PRDWriter = makeWriter()): Hono {
  const app = new Hono();
  app.route("/api/prd", createPRDRouter(store, writer, null));
  return app;
}

describe("PRD API contract tests", () => {
  it("GET /api/prd/:projectKey/drafts — returns list", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/prd/PROJ/drafts");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: PRDDraft[] };
    expect(body.data).toHaveLength(1);
  });

  it("POST /api/prd/:projectKey/drafts/generate — generates draft", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/prd/PROJ/drafts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "Build the login flow", document_type: "prd" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; data: PRDDraft };
    expect(body.data.id).toBeDefined();
  });

  it("GET /api/prd/:projectKey/drafts/:id — returns draft", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/prd/PROJ/drafts/draft-1");
    expect(res.status).toBe(200);
  });

  it("GET /api/prd/:projectKey/drafts/:id — 404 for unknown", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/prd/PROJ/drafts/nope");
    expect(res.status).toBe(404);
  });

  it("GET /api/prd/:projectKey/drafts/:id/diff — returns empty diff when no confluence_url", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/prd/PROJ/drafts/draft-1/diff");
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { before: string; after: string } };
    expect(body.data.before).toBe("");
    expect(body.data.after).toBe("");
  });

  it("POST /api/prd/:projectKey/drafts/:id/approve — approves draft", async () => {
    const app = makeApp(makeStore());
    const res = await app.request("/api/prd/PROJ/drafts/draft-1/approve", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: PRDDraft };
    expect(body.data.status).toBe("approved");
  });

  it("POST /api/prd/:projectKey/drafts/:id/publish — 403 when not approved", async () => {
    // draft has status 'draft', not 'approved'
    const app = makeApp(makeStore(makeDraft({ status: "draft" })));
    const res = await app.request("/api/prd/PROJ/drafts/draft-1/publish", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("POST /api/prd/:projectKey/drafts/:id/publish — 503 when no publisher configured", async () => {
    // With approved draft but null publisher
    const app = makeApp(makeStore(makeDraft({ status: "approved" })));
    const res = await app.request("/api/prd/PROJ/drafts/draft-1/publish", { method: "POST" });
    expect(res.status).toBe(503);
  });
});
