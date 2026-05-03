/**
 * OpenAI-compatible LLM adapter.
 * Works with OpenAI, Azure OpenAI, Ollama, and any OpenAI-compatible endpoint.
 */

import OpenAI from "openai";
import type { LLMAdapter, LLMTrace } from "./types.js";
import { LLMDegradedError } from "./types.js";
import { logger } from "../utils/logger.js";

export class OpenAICompatAdapter implements LLMAdapter {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(opts: {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    embeddingModel?: string;
  }) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl ?? "https://api.openai.com/v1",
    });
    this.model = opts.model ?? "gpt-4o-mini";
    this.embeddingModel = opts.embeddingModel ?? "text-embedding-3-small";
  }

  async complete<T>(
    prompt: string,
    _schema: Record<string, unknown>
  ): Promise<{ result: T; trace: LLMTrace }> {
    const start = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const latency_ms = Date.now() - start;
      const text = response.choices[0]?.message?.content ?? "{}";
      const result = JSON.parse(text) as T;
      const trace: LLMTrace = {
        model: this.model,
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        latency_ms,
        degraded: false,
      };
      logger.info("llm_call", { model: this.model, latency_ms, degraded: false });
      return { result, trace };
    } catch (err) {
      const latency_ms = Date.now() - start;
      const trace: LLMTrace = {
        model: this.model,
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms,
        degraded: true,
        reason: String(err),
      };
      logger.warn("llm_call_failed", { model: this.model, latency_ms, error: String(err) });
      throw Object.assign(new LLMDegradedError(String(err)), { trace });
    }
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; trace: LLMTrace }> {
    const start = Date.now();
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts,
      });
      const latency_ms = Date.now() - start;
      const vectors = response.data.map((d) => d.embedding);
      const trace: LLMTrace = {
        model: this.embeddingModel,
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: 0,
        latency_ms,
        degraded: false,
      };
      logger.info("llm_embed", { model: this.embeddingModel, count: texts.length, latency_ms });
      return { vectors, trace };
    } catch (err) {
      const latency_ms = Date.now() - start;
      const trace: LLMTrace = {
        model: this.embeddingModel,
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms,
        degraded: true,
        reason: String(err),
      };
      throw Object.assign(new LLMDegradedError(String(err)), { trace });
    }
  }
}
