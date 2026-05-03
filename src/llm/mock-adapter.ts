/**
 * Deterministic mock LLM adapter for tests.
 * Returns configurable fixture responses without making network calls.
 */

import type { LLMAdapter, LLMTrace } from "./types.js";

const ZERO_TRACE: Omit<LLMTrace, "model"> = {
  prompt_tokens: 10,
  completion_tokens: 20,
  latency_ms: 1,
  degraded: true,
  reason: "mock adapter — DEGRADED_LLM=true or no API key",
};

export class MockLLMAdapter implements LLMAdapter {
  private readonly completionFixtures: Map<string, unknown> = new Map();
  private readonly embedDim: number;

  constructor(opts: { embedDim?: number } = {}) {
    this.embedDim = opts.embedDim ?? 8;
  }

  /** Register a fixture response for a given prompt substring match key. */
  setFixture(key: string, value: unknown): void {
    this.completionFixtures.set(key, value);
  }

  async complete<T>(
    prompt: string,
    _schema: Record<string, unknown>
  ): Promise<{ result: T; trace: LLMTrace }> {
    // Find first fixture whose key appears in the prompt
    for (const [key, value] of this.completionFixtures) {
      if (prompt.includes(key)) {
        return {
          result: value as T,
          trace: { model: "mock", ...ZERO_TRACE },
        };
      }
    }
    // Default: return empty object
    return {
      result: {} as T,
      trace: { model: "mock", ...ZERO_TRACE },
    };
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; trace: LLMTrace }> {
    // Deterministic pseudo-embeddings based on text length
    const vectors = texts.map((t) =>
      Array.from({ length: this.embedDim }, (_, i) => ((t.charCodeAt(i % t.length) ?? 0) % 256) / 255)
    );
    return {
      vectors,
      trace: { model: "mock-embed", ...ZERO_TRACE },
    };
  }
}
