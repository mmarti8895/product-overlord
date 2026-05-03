/**
 * RAG retrieval — query the KB vector store with a 2-second timeout guard.
 */
import type { RetrievedChunk } from "../knowledge/types.js";
import type { KBStore } from "../knowledge/store.js";
import type { LLMAdapter } from "../llm/types.js";
/**
 * Retrieve top-K chunks for a query from the KB store.
 * Times out after 2 s and returns [] to avoid blocking the analysis pipeline.
 */
export declare function retrieveChunks(query: string, projectKey: string, store: KBStore, adapter: LLMAdapter, topK?: number): Promise<RetrievedChunk[]>;
