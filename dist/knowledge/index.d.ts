/**
 * KnowledgeBase facade.
 * Orchestrates: parse → chunk → embed → store.
 * Enforces 50 MB upload limit and KB_MAX_SIZE_GB store guard.
 */
import { KBStore } from "./store.js";
import type { KBSource, IngestResult } from "./types.js";
import type { LLMAdapter } from "../llm/types.js";
export declare class KnowledgeBase {
    private readonly store;
    private readonly adapter;
    private readonly maxSizeBytes;
    constructor(opts: {
        storePath: string;
        maxSizeGb: number;
        adapter: LLMAdapter;
    });
    /** Ingest a file buffer. */
    ingestFile(buffer: Buffer, filename: string, projectKey: string): Promise<IngestResult>;
    /** Crawl a URL and ingest all pages. */
    crawlUrl(url: string, projectKey: string, depth?: number): Promise<IngestResult>;
    listSources(projectKey: string): Promise<KBSource[]>;
    deleteSource(sourceId: string): Promise<void>;
    sizeBytes(): Promise<number>;
    getStore(): KBStore;
    private _guardStoreSize;
}
