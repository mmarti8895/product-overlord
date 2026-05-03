/**
 * OpportunitySizer — converts a FeedbackTheme into an OpportunityCandidate (task 2.7)
 *
 * Uses LLM to estimate reach and impact, falls back to heuristics.
 */
import type { LLMAdapter } from "../llm/types.js";
import type { FeedbackTheme, OpportunityCandidate } from "../types/discovery.js";
export declare class OpportunitySizer {
    private readonly llm;
    constructor(llm: LLMAdapter);
    size(theme: FeedbackTheme): Promise<OpportunityCandidate>;
}
