/**
 * DraftStore — LanceDB persistence for PRD drafts (prd-generation task 2.2)
 */

import { randomUUID } from "crypto";
import type { PRDDraft } from "../types/prd.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB(): Promise<any> {
  return (await import("@lancedb/lancedb")) as any;
}

export class DraftStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any | null = null;

  constructor(private readonly storePath: string) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getDb(): Promise<any> {
    if (!this.db) {
      const lancedb = await getLanceDB();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }

  private async all(): Promise<PRDDraft[]> {
    try {
      const db = await this.getDb();
      const names: string[] = await db.tableNames();
      if (!names.includes("prd_drafts")) return [];
      const t = await db.openTable("prd_drafts");
      return (await t.query().toArray()) as PRDDraft[];
    } catch { return []; }
  }

  private async insert(draft: PRDDraft): Promise<void> {
    const db = await this.getDb();
    const names: string[] = await db.tableNames();
    if (!names.includes("prd_drafts")) {
      await db.createTable("prd_drafts", [draft]);
    } else {
      const t = await db.openTable("prd_drafts");
      await t.add([draft]);
    }
  }

  private async remove(id: string): Promise<void> {
    try {
      const db = await this.getDb();
      const t = await db.openTable("prd_drafts");
      await t.delete(`id = '${id}'`);
    } catch (e) {
      logger.error("DraftStore.remove failed", { err: String(e) });
    }
  }

  async listDrafts(projectKey: string): Promise<PRDDraft[]> {
    const all = await this.all();
    return all.filter((d) => d.project_key === projectKey).sort((a, b) => b.version - a.version);
  }

  async getDraft(id: string): Promise<PRDDraft | null> {
    const all = await this.all();
    return all.find((d) => d.id === id) ?? null;
  }

  async latestDraft(projectKey: string): Promise<PRDDraft | null> {
    const drafts = await this.listDrafts(projectKey);
    return drafts[0] ?? null;
  }

  async saveDraft(input: Omit<PRDDraft, "id" | "version" | "created_at" | "updated_at">): Promise<PRDDraft> {
    const existing = await this.listDrafts(input.project_key);
    const version  = (existing[0]?.version ?? 0) + 1;
    const now      = new Date().toISOString();
    const draft: PRDDraft = { id: randomUUID(), version, created_at: now, updated_at: now, ...input };
    await this.insert(draft);
    return draft;
  }

  async approve(id: string): Promise<PRDDraft> {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error(`Draft ${id} not found`);
    if (draft.status !== "draft") throw new Error(`Draft ${id} is not in draft status`);
    const updated: PRDDraft = { ...draft, status: "approved", updated_at: new Date().toISOString() };
    await this.remove(id);
    await this.insert(updated);
    return updated;
  }

  async markPublished(id: string, confluenceUrl: string): Promise<PRDDraft> {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error(`Draft ${id} not found`);
    if (draft.status !== "approved") throw new Error(`Draft ${id} must be approved before publishing`);
    const updated: PRDDraft = { ...draft, status: "published", confluence_url: confluenceUrl, updated_at: new Date().toISOString() };
    await this.remove(id);
    await this.insert(updated);
    return updated;
  }
}
