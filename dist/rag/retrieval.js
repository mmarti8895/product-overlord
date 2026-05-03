/**
 * RAG retrieval — query the KB vector store with a 2-second timeout guard.
 */
import { logger } from "../utils/logger.js";
const RETRIEVAL_TIMEOUT_MS = 2_000;
/**
 * Retrieve top-K chunks for a query from the KB store.
 * Times out after 2 s and returns [] to avoid blocking the analysis pipeline.
 */
export async function retrieveChunks(query, projectKey, store, adapter, topK = 5) {
    const start = Date.now();
    try {
        const result = await Promise.race([
            _retrieve(query, projectKey, store, adapter, topK),
            _timeout(RETRIEVAL_TIMEOUT_MS),
        ]);
        const latency_ms = Date.now() - start;
        logger.info("rag_retrieval", { chunk_count: result.length, latency_ms, timeout: false, project_key: projectKey });
        return result;
    }
    catch (err) {
        const latency_ms = Date.now() - start;
        const timedOut = err instanceof RetrievalTimeoutError;
        logger.warn("rag_retrieval_failed", { error: String(err), latency_ms, timeout: timedOut, project_key: projectKey });
        return [];
    }
}
async function _retrieve(query, projectKey, store, adapter, topK) {
    const { vectors } = await adapter.embed([query]);
    return store.search(vectors[0], projectKey, topK);
}
class RetrievalTimeoutError extends Error {
    constructor() { super("RAG retrieval timed out"); }
}
function _timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new RetrievalTimeoutError()), ms));
}
