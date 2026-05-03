/**
 * Embedder — batch-embeds text chunks via LLMAdapter.
 */
const BATCH_SIZE = 32;
/**
 * Embed an array of text strings in batches.
 * Returns vectors parallel to input texts.
 */
export async function embedTexts(texts, adapter) {
    const vectors = [];
    const traces = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const { vectors: batchVectors, trace } = await adapter.embed(batch);
        vectors.push(...batchVectors);
        traces.push(trace);
    }
    return { vectors, traces };
}
