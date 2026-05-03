/**
 * LLM adapter factory.
 * Returns MockLLMAdapter when DEGRADED_LLM=true or no API key available.
 */
import type { LLMAdapter } from "./types.js";
export type { LLMAdapter, LLMTrace, LLMDegradedError, PromptContext } from "./types.js";
export { MockLLMAdapter } from "./mock-adapter.js";
export { OpenAICompatAdapter } from "./openai-compat.js";
export { RateLimiter } from "./rate-limiter.js";
export { enrichReadinessPrompt, groundPlanPrompt } from "./prompts.js";
export interface LLMConfig {
    apiKey: string | undefined;
    baseUrl: string;
    model: string;
    embeddingModel: string;
    callsPerMinute: number;
    degraded: boolean;
}
export declare function createLLMAdapter(config: LLMConfig): LLMAdapter;
