/**
 * RAG retrieval — query the KB vector store with a 2-second timeout guard.
 */

import type { RetrievedChunk } from "../knowledge/types.js";
import type { KBStore } from "../knowledge/store.js";
import type { LLMAdapter } from "../llm/types.js";
import { logger } from "../utils/logger.js";

const RETRIEVAL_TIMEOUT_MS = 2_000;

/**
 * Retrieve top-K chunks for a query from the KB store.
 * Times out after 2 s and returns [] to avoid blocking the analysis pipeline.
 */
export async function retrieveChunks(
  query: string,
  projectKey: string,
  store: KBStore,
  adapter: LLMAdapter,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      _retrieve(query, projectKey, store, adapter, topK),
      _timeout(RETRIEVAL_TIMEOUT_MS),
    ]);
    const latency_ms = Date.now() - start;
    logger.info("rag_retrieval", { chunk_count: result.length, latency_ms, timeout: false, project_key: projectKey });
    return result;
  } catch (err) {
    const latency_ms = Date.now() - start;
    const timedOut = err instanceof RetrievalTimeoutError;
    logger.warn("rag_retrieval_failed", { error: String(err), latency_ms, timeout: timedOut, project_key: projectKey });
    return [];
  }
}

async function _retrieve(
  query: string,
  projectKey: string,
  store: KBStore,
  adapter: LLMAdapter,
  topK: number
): Promise<RetrievedChunk[]> {
  const { vectors } = await adapter.embed([query]);
  return store.search(vectors[0], projectKey, topK);
}

class RetrievalTimeoutError extends Error {
  constructor() { super("RAG retrieval timed out"); }
}

function _timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new RetrievalTimeoutError()), ms)
  );
}
