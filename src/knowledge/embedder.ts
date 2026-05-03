/**
 * Embedder — batch-embeds text chunks via LLMAdapter.
 */

import type { LLMAdapter, LLMTrace } from "../llm/types.js";

const BATCH_SIZE = 32;

export interface EmbedResult {
  vectors: number[][];
  traces: LLMTrace[];
}

/**
 * Embed an array of text strings in batches.
 * Returns vectors parallel to input texts.
 */
export async function embedTexts(
  texts: string[],
  adapter: LLMAdapter
): Promise<EmbedResult> {
  const vectors: number[][] = [];
  const traces: LLMTrace[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { vectors: batchVectors, trace } = await adapter.embed(batch);
    vectors.push(...batchVectors);
    traces.push(trace);
  }

  return { vectors, traces };
}
