/**
 * Unit tests — DraftStore (prd-generation task 5.1)
 *
 * Uses a real in-memory LanceDB via tmp path.
 * Covers: save, get, list, version increment, approve, markPublished.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { DraftStore } from "../../stores/draft-store.js";
import type { PRDDraft } from "../../types/prd.js";

function makeDraftInput(): Omit<PRDDraft, "id" | "version" | "created_at" | "updated_at"> {
  return {
    project_key: "PROJ",
    epic_key: "PROJ-100",
    document_type: "prd",
    title: "My PRD",
    status: "draft",
    content: { sections: [{ id: "s1", heading: "Overview", body: "We are building X.", order: 1 }], rag_sources: [] },
    confluence_url: null,
  };
}

let store: DraftStore;

beforeEach(() => {
  const tmp = mkdtempSync(join(tmpdir(), "draft-store-test-"));
  store = new DraftStore(tmp);
});

describe("DraftStore", () => {
  it("saves and retrieves a draft", async () => {
    const draft = await store.saveDraft(makeDraftInput());
    expect(draft.id).toBeDefined();
    expect(draft.version).toBe(1);

    const fetched = await store.getDraft(draft.id);
    expect(fetched?.id).toBe(draft.id);
  });

  it("version increments on second save for same project_key", async () => {
    await store.saveDraft(makeDraftInput());
    const second = await store.saveDraft(makeDraftInput());
    expect(second.version).toBe(2);
  });

  it("listDrafts returns all drafts for project sorted by version desc", async () => {
    await store.saveDraft(makeDraftInput());
    await store.saveDraft(makeDraftInput());
    const list = await store.listDrafts("PROJ");
    expect(list).toHaveLength(2);
    expect(list[0].version).toBeGreaterThan(list[1].version);
  });

  it("approve — sets status to approved", async () => {
    const draft = await store.saveDraft(makeDraftInput());
    const approved = await store.approve(draft.id);
    expect(approved.status).toBe("approved");
  });

  it("markPublished — sets status to published and stores url", async () => {
    const draft = await store.saveDraft(makeDraftInput());
    await store.approve(draft.id);
    const published = await store.markPublished(draft.id, "https://wiki/page");
    expect(published?.status).toBe("published");
    expect(published?.confluence_url).toBe("https://wiki/page");
  });

  it("getDraft returns null for unknown id", async () => {
    const result = await store.getDraft("does-not-exist");
    expect(result).toBeNull();
  });
});
