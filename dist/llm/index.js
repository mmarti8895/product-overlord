/**
 * LLM adapter factory.
 * Returns MockLLMAdapter when DEGRADED_LLM=true or no API key available.
 */
import { MockLLMAdapter } from "./mock-adapter.js";
import { OpenAICompatAdapter } from "./openai-compat.js";
export { MockLLMAdapter } from "./mock-adapter.js";
export { OpenAICompatAdapter } from "./openai-compat.js";
export { RateLimiter } from "./rate-limiter.js";
export { enrichReadinessPrompt, groundPlanPrompt } from "./prompts.js";
export function createLLMAdapter(config) {
    if (config.degraded || !config.apiKey) {
        return new MockLLMAdapter();
    }
    return new OpenAICompatAdapter({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        embeddingModel: config.embeddingModel,
    });
}
