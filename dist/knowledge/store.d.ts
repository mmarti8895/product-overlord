/**
 * KBStore — LanceDB-backed vector store for knowledge base chunks.
 * Partitioned by project_key. Zero external infrastructure required.
 */
import type { KBChunk, KBSource, RetrievedChunk } from "./types.js";
export declare class KBStore {
    private readonly storePath;
    private db;
    constructor(storePath: string);
    private getDb;
    /** Ingest pre-embedded chunks into the store. */
    ingest(source: KBSource, chunks: KBChunk[]): Promise<void>;
    /** ANN search for top-K chunks matching the query vector, filtered by project_key. */
    search(queryVector: number[], projectKey: string, topK?: number): Promise<RetrievedChunk[]>;
    /** List all sources for a project. */
    listSources(projectKey: string): Promise<KBSource[]>;
    /** Delete all chunks and source record for a given source_id. */
    deleteSource(sourceId: string): Promise<void>;
    /** Approximate total size in bytes of all stored data. */
    sizeBytes(): Promise<number>;
}
export declare function makeSourceId(): string;
