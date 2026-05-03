/**
 * ThemeClusterer — groups FeedbackDocuments into FeedbackThemes (task 2.6)
 *
 * Algorithm:
 *  1. Embed all document texts via LLM.
 *  2. k-means (cosine) into up to K clusters.
 *  3. LLM call to name each cluster and pick representative quotes.
 */
import type { LLMAdapter } from "../llm/types.js";
import type { FeedbackDocument, FeedbackTheme } from "../types/discovery.js";
export declare class ThemeClusterer {
    private readonly llm;
    constructor(llm: LLMAdapter);
    cluster(docs: FeedbackDocument[], k?: number): Promise<FeedbackTheme[]>;
    private buildTheme;
}
