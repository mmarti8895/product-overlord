/**
 * DraftStore — LanceDB persistence for PRD drafts (prd-generation task 2.2)
 */
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB() {
    return (await import("@lancedb/lancedb"));
}
export class DraftStore {
    storePath;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = null;
    constructor(storePath) {
        this.storePath = storePath;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getDb() {
        if (!this.db) {
            const lancedb = await getLanceDB();
            this.db = await lancedb.connect(this.storePath);
        }
        return this.db;
    }
    /** Serialize complex nested fields to JSON strings for LanceDB storage */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serialize(draft) {
        return {
            ...draft,
            content: JSON.stringify(draft.content),
            // LanceDB cannot infer schema for null values — store as empty string sentinel
            confluence_url: draft.confluence_url ?? "",
            epic_key: draft.epic_key ?? "",
        };
    }
    deserialize(row) {
        return {
            ...row,
            content: typeof row.content === "string" ? JSON.parse(row.content) : row.content,
            confluence_url: row.confluence_url === "" ? null : row.confluence_url,
            epic_key: row.epic_key === "" ? null : row.epic_key,
        };
    }
    async all() {
        try {
            const db = await this.getDb();
            const names = await db.tableNames();
            if (!names.includes("prd_drafts"))
                return [];
            const t = await db.openTable("prd_drafts");
            const rows = await t.query().toArray();
            return rows.map(r => this.deserialize(r));
        }
        catch {
            return [];
        }
    }
    async insert(draft) {
        const row = this.serialize(draft);
        const db = await this.getDb();
        const names = await db.tableNames();
        if (!names.includes("prd_drafts")) {
            await db.createTable("prd_drafts", [row]);
        }
        else {
            const t = await db.openTable("prd_drafts");
            await t.add([row]);
        }
    }
    async remove(id) {
        try {
            const db = await this.getDb();
            const t = await db.openTable("prd_drafts");
            await t.delete(`id = '${id}'`);
        }
        catch (e) {
            logger.error("DraftStore.remove failed", { err: String(e) });
        }
    }
    async listDrafts(projectKey) {
        const all = await this.all();
        return all.filter((d) => d.project_key === projectKey).sort((a, b) => b.version - a.version);
    }
    async getDraft(id) {
        const all = await this.all();
        return all.find((d) => d.id === id) ?? null;
    }
    async latestDraft(projectKey) {
        const drafts = await this.listDrafts(projectKey);
        return drafts[0] ?? null;
    }
    async saveDraft(input) {
        const existing = await this.listDrafts(input.project_key);
        const version = (existing[0]?.version ?? 0) + 1;
        const now = new Date().toISOString();
        const draft = { id: randomUUID(), version, created_at: now, updated_at: now, ...input };
        await this.insert(draft);
        return draft;
    }
    async approve(id) {
        const draft = await this.getDraft(id);
        if (!draft)
            throw new Error(`Draft ${id} not found`);
        if (draft.status !== "draft")
            throw new Error(`Draft ${id} is not in draft status`);
        const updated = { ...draft, status: "approved", updated_at: new Date().toISOString() };
        await this.remove(id);
        await this.insert(updated);
        return updated;
    }
    async markPublished(id, confluenceUrl) {
        const draft = await this.getDraft(id);
        if (!draft)
            throw new Error(`Draft ${id} not found`);
        if (draft.status !== "approved")
            throw new Error(`Draft ${id} must be approved before publishing`);
        const updated = { ...draft, status: "published", confluence_url: confluenceUrl, updated_at: new Date().toISOString() };
        await this.remove(id);
        await this.insert(updated);
        return updated;
    }
}
