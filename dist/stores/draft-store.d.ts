/**
 * DraftStore — LanceDB persistence for PRD drafts (prd-generation task 2.2)
 */
import type { PRDDraft } from "../types/prd.js";
export declare class DraftStore {
    private readonly storePath;
    private db;
    constructor(storePath: string);
    private getDb;
    /** Serialize complex nested fields to JSON strings for LanceDB storage */
    private serialize;
    private deserialize;
    private all;
    private insert;
    private remove;
    listDrafts(projectKey: string): Promise<PRDDraft[]>;
    getDraft(id: string): Promise<PRDDraft | null>;
    latestDraft(projectKey: string): Promise<PRDDraft | null>;
    saveDraft(input: Omit<PRDDraft, "id" | "version" | "created_at" | "updated_at">): Promise<PRDDraft>;
    approve(id: string): Promise<PRDDraft>;
    markPublished(id: string, confluenceUrl: string): Promise<PRDDraft>;
}
