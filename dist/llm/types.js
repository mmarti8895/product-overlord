/**
 * LLM Adapter — shared types
 */
// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class LLMDegradedError extends Error {
    constructor(reason) {
        super(`LLM unavailable: ${reason}`);
        this.name = "LLMDegradedError";
    }
}
