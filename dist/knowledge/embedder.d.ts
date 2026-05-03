/**
 * Embedder — batch-embeds text chunks via LLMAdapter.
 */
import type { LLMAdapter, LLMTrace } from "../llm/types.js";
export interface EmbedResult {
    vectors: number[][];
    traces: LLMTrace[];
}
/**
 * Embed an array of text strings in batches.
 * Returns vectors parallel to input texts.
 */
export declare function embedTexts(texts: string[], adapter: LLMAdapter): Promise<EmbedResult>;
