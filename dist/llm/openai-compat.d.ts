/**
 * OpenAI-compatible LLM adapter.
 * Works with OpenAI, Azure OpenAI, Ollama, and any OpenAI-compatible endpoint.
 */
import type { LLMAdapter, LLMTrace } from "./types.js";
export declare class OpenAICompatAdapter implements LLMAdapter {
    private readonly client;
    private readonly model;
    private readonly embeddingModel;
    constructor(opts: {
        apiKey: string;
        baseUrl?: string;
        model?: string;
        embeddingModel?: string;
    });
    complete<T>(prompt: string, _schema: Record<string, unknown>): Promise<{
        result: T;
        trace: LLMTrace;
    }>;
    embed(texts: string[]): Promise<{
        vectors: number[][];
        trace: LLMTrace;
    }>;
}
