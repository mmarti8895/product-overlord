/**
 * LLM Adapter — shared types
 */
export interface LLMTrace {
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    latency_ms: number;
    /** true when the adapter fell back to degraded mode (no call made) */
    degraded: boolean;
    /** present when degraded=true */
    reason?: string;
}
export declare class LLMDegradedError extends Error {
    constructor(reason: string);
}
export interface PromptContext {
    ticketKey: string;
    ticketSummary: string;
    acceptanceCriteria: string | null;
    description: string;
    /** Retrieved KT / code chunks formatted as <context> block */
    contextBlock: string;
    /** Deterministic readiness result (JSON-serialised) */
    deterministicResult?: string;
    /** Candidate components list (JSON-serialised) */
    candidateComponents?: string;
    /** Fetched file contents keyed by file path */
    fileContents?: Record<string, string>;
}
export interface LLMAdapter {
    /**
     * Complete a chat prompt with structured JSON output.
     * @param prompt  Full prompt string (system + user combined)
     * @param schema  JSON schema object describing the expected output shape
     * @returns Parsed, schema-validated object + trace
     */
    complete<T>(prompt: string, schema: Record<string, unknown>): Promise<{
        result: T;
        trace: LLMTrace;
    }>;
    /**
     * Embed a list of text strings into dense vectors.
     * @returns Float32 vectors parallel to input texts + trace
     */
    embed(texts: string[]): Promise<{
        vectors: number[][];
        trace: LLMTrace;
    }>;
}
