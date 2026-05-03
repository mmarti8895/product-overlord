/**
 * Unit tests for the LLM adapter layer (Task 2.7)
 */
import { describe, it, expect } from "vitest";
import { MockLLMAdapter } from "../../llm/mock-adapter.js";
import { RateLimiter } from "../../llm/rate-limiter.js";
import { enrichReadinessPrompt, groundPlanPrompt } from "../../llm/prompts.js";
import { createLLMAdapter } from "../../llm/index.js";
// ---------------------------------------------------------------------------
// MockLLMAdapter
// ---------------------------------------------------------------------------
describe("MockLLMAdapter", () => {
    it("returns empty object by default", async () => {
        const adapter = new MockLLMAdapter();
        const { result, trace } = await adapter.complete("some prompt", {});
        expect(result).toEqual({});
        expect(trace.degraded).toBe(true); // mock always marks degraded=true
        expect(trace.model).toBe("mock");
    });
    it("returns fixture matching prompt substring", async () => {
        const adapter = new MockLLMAdapter();
        adapter.setFixture("enrich", { additional_missing_items: [{ dimension: "ac", severity: "high" }] });
        const { result } = await adapter.complete("Please enrich this ticket", {});
        expect(result.additional_missing_items).toHaveLength(1);
    });
    it("embed returns deterministic vectors of correct dimension", async () => {
        const adapter = new MockLLMAdapter({ embedDim: 4 });
        const { vectors, trace } = await adapter.embed(["hello", "world"]);
        expect(vectors).toHaveLength(2);
        expect(vectors[0]).toHaveLength(4);
        expect(trace.degraded).toBe(true); // mock always marks degraded=true
    });
});
// ---------------------------------------------------------------------------
// createLLMAdapter factory
// ---------------------------------------------------------------------------
describe("createLLMAdapter", () => {
    it("returns MockLLMAdapter when degraded=true", () => {
        const config = {
            apiKey: "sk-test",
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-4o-mini",
            embeddingModel: "text-embedding-3-small",
            callsPerMinute: 60,
            degraded: true,
        };
        const adapter = createLLMAdapter(config);
        expect(adapter).toBeInstanceOf(MockLLMAdapter);
    });
    it("returns MockLLMAdapter when apiKey is absent", () => {
        const config = {
            apiKey: undefined,
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-4o-mini",
            embeddingModel: "text-embedding-3-small",
            callsPerMinute: 60,
            degraded: false,
        };
        const adapter = createLLMAdapter(config);
        expect(adapter).toBeInstanceOf(MockLLMAdapter);
    });
});
// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------
describe("RateLimiter", () => {
    it("executes calls within budget immediately", async () => {
        const limiter = new RateLimiter(100);
        const results = [];
        await Promise.all([
            limiter.run(async () => { results.push(1); }),
            limiter.run(async () => { results.push(2); }),
            limiter.run(async () => { results.push(3); }),
        ]);
        expect(results).toHaveLength(3);
    });
    it("passes through return value", async () => {
        const limiter = new RateLimiter(10);
        const val = await limiter.run(async () => 42);
        expect(val).toBe(42);
    });
});
// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
describe("enrichReadinessPrompt", () => {
    it("renders without I/O and includes ticket key", () => {
        const ctx = {
            ticketKey: "TEST-99",
            ticketSummary: "Add login",
            acceptanceCriteria: "User can log in",
            description: "Implement OAuth",
            contextBlock: "<context>some context</context>",
        };
        const prompt = enrichReadinessPrompt(ctx);
        expect(prompt).toContain("TEST-99");
        expect(prompt).toContain("Add login");
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(50);
    });
    it("handles null acceptance criteria", () => {
        const ctx = {
            ticketKey: "TEST-1",
            ticketSummary: "Fix bug",
            acceptanceCriteria: null,
            description: "desc",
            contextBlock: "",
        };
        const prompt = enrichReadinessPrompt(ctx);
        expect(prompt).toContain("(none provided)");
    });
});
describe("groundPlanPrompt", () => {
    it("renders without I/O and includes candidate components", () => {
        const ctx = {
            ticketKey: "TEST-99",
            ticketSummary: "Refactor auth",
            acceptanceCriteria: null,
            description: "desc",
            contextBlock: "",
            candidateComponents: JSON.stringify([{ name: "AuthService", confidence: 0.9 }]),
        };
        const prompt = groundPlanPrompt(ctx);
        expect(prompt).toContain("TEST-99");
        expect(prompt).toContain("AuthService");
    });
});
