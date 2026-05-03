/**
 * Deterministic mock LLM adapter for tests.
 * Returns configurable fixture responses without making network calls.
 */
import type { LLMAdapter, LLMTrace } from "./types.js";
export declare class MockLLMAdapter implements LLMAdapter {
    private readonly completionFixtures;
    private readonly embedDim;
    constructor(opts?: {
        embedDim?: number;
    });
    /** Register a fixture response for a given prompt substring match key. */
    setFixture(key: string, value: unknown): void;
    complete<T>(prompt: string, _schema: Record<string, unknown>): Promise<{
        result: T;
        trace: LLMTrace;
    }>;
    embed(texts: string[]): Promise<{
        vectors: number[][];
        trace: LLMTrace;
    }>;
}
