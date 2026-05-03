/**
 * Deterministic mock LLM adapter for tests.
 * Returns configurable fixture responses without making network calls.
 */
const ZERO_TRACE = {
    prompt_tokens: 10,
    completion_tokens: 20,
    latency_ms: 1,
    degraded: true,
    reason: "mock adapter — DEGRADED_LLM=true or no API key",
};
export class MockLLMAdapter {
    completionFixtures = new Map();
    embedDim;
    constructor(opts = {}) {
        this.embedDim = opts.embedDim ?? 8;
    }
    /** Register a fixture response for a given prompt substring match key. */
    setFixture(key, value) {
        this.completionFixtures.set(key, value);
    }
    async complete(prompt, _schema) {
        // Find first fixture whose key appears in the prompt
        for (const [key, value] of this.completionFixtures) {
            if (prompt.includes(key)) {
                return {
                    result: value,
                    trace: { model: "mock", ...ZERO_TRACE },
                };
            }
        }
        // Default: return empty object
        return {
            result: {},
            trace: { model: "mock", ...ZERO_TRACE },
        };
    }
    async embed(texts) {
        // Deterministic pseudo-embeddings based on text length
        const vectors = texts.map((t) => Array.from({ length: this.embedDim }, (_, i) => ((t.charCodeAt(i % t.length) ?? 0) % 256) / 255));
        return {
            vectors,
            trace: { model: "mock-embed", ...ZERO_TRACE },
        };
    }
}
