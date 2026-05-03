/**
 * Task 4.4 — Unit tests for RAG retrieval, context builder, file fetcher
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { retrieveChunks } from "../../rag/retrieval.js";
import { buildContext } from "../../rag/context-builder.js";
import { fetchTopFiles } from "../../rag/file-fetcher.js";
import type { RetrievedChunk } from "../../knowledge/types.js";
import type { KBStore } from "../../knowledge/store.js";
import type { LLMAdapter } from "../../llm/types.js";
import type { LLMTrace } from "../../llm/types.js";
import type { FileContentAdapter, CandidateRef } from "../../rag/file-fetcher.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrace(overrides?: Partial<LLMTrace>): LLMTrace {
  return {
    model: "mock",
    prompt_tokens: 10,
    completion_tokens: 5,
    latency_ms: 5,
    degraded: true,
    ...overrides,
  };
}

function makeChunk(overrides?: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    id: "c1",
    source_id: "src1",
    text: "Sample KT chunk text about authentication flow.",
    score: 0.85,
    ...overrides,
  };
}

function makeStore(chunks: RetrievedChunk[]): KBStore {
  return {
    search: vi.fn().mockResolvedValue(chunks),
  } as unknown as KBStore;
}

function makeAdapter(vector: number[] = [0.1, 0.2, 0.3]): LLMAdapter {
  return {
    embed: vi.fn().mockResolvedValue({ vectors: [vector], trace: makeTrace() }),
    complete: vi.fn(),
  } as unknown as LLMAdapter;
}

// ---------------------------------------------------------------------------
// retrieveChunks
// ---------------------------------------------------------------------------

describe("retrieveChunks", () => {
  it("returns chunks on success", async () => {
    const chunks = [makeChunk()];
    const store = makeStore(chunks);
    const adapter = makeAdapter();

    const result = await retrieveChunks("auth flow", "PROJ", store, adapter, 5);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toContain("authentication");
  });

  it("returns [] when store throws", async () => {
    const store = {
      search: vi.fn().mockRejectedValue(new Error("DB error")),
    } as unknown as KBStore;
    const adapter = makeAdapter();

    const result = await retrieveChunks("auth flow", "PROJ", store, adapter, 5);
    expect(result).toEqual([]);
  });

  it("returns [] on 2s timeout", async () => {
    vi.useFakeTimers();

    const store = {
      search: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 5_000))),
    } as unknown as KBStore;
    const adapter = makeAdapter();

    const promise = retrieveChunks("auth flow", "PROJ", store, adapter, 5);
    vi.advanceTimersByTime(2_500);
    const result = await promise;
    expect(result).toEqual([]);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// buildContext
// ---------------------------------------------------------------------------

describe("buildContext", () => {
  it("assembles context block with KT chunks", () => {
    const chunks = [makeChunk({ score: 0.9 }), makeChunk({ id: "c2", score: 0.7, text: "Another KT chunk." })];
    const { contextBlock, tokensUsed } = buildContext(chunks, []);
    expect(contextBlock).toContain("Knowledge Base Context");
    expect(contextBlock).toContain("authentication");
    expect(tokensUsed).toBeGreaterThan(0);
  });

  it("places highest-score chunks first", () => {
    const chunks = [
      makeChunk({ id: "low", score: 0.3, text: "Low score chunk." }),
      makeChunk({ id: "high", score: 0.95, text: "High score chunk." }),
    ];
    const { contextBlock } = buildContext(chunks, []);
    const highIdx = contextBlock.indexOf("High score chunk");
    const lowIdx = contextBlock.indexOf("Low score chunk");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("includes file contents section", () => {
    const { contextBlock } = buildContext([], [{ path: "src/auth.ts", content: "export function auth() {}", trace: { adapter: "repo-adapter", operation: "getFileContent", latencyMs: 10, retryCount: 0 } }]);
    expect(contextBlock).toContain("Relevant Source Files");
    expect(contextBlock).toContain("src/auth.ts");
  });

  it("respects 12K token budget by dropping lowest-score chunks", () => {
    // Build many chunks that together exceed budget
    const chunks: RetrievedChunk[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      source_id: "src",
      text: "x".repeat(500), // ~125 tokens each
      score: i / 100,
    }));
    const { tokensUsed } = buildContext(chunks, []);
    expect(tokensUsed).toBeLessThanOrEqual(12_100); // slight rounding tolerance
  });

  it("returns empty string when no chunks and no files", () => {
    const { contextBlock, tokensUsed } = buildContext([], []);
    expect(contextBlock).toBe("");
    expect(tokensUsed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchTopFiles
// ---------------------------------------------------------------------------

describe("fetchTopFiles", () => {
  const makeFileAdapter = (content: string, sizeOverride?: number): FileContentAdapter => ({
    getFileContent: vi.fn().mockResolvedValue({
      content: sizeOverride !== undefined ? "x".repeat(sizeOverride) : content,
      trace: { adapter: "repo-adapter", operation: "getFileContent", latencyMs: 10, retryCount: 0 },
    }),
  });

  const candidates: CandidateRef[] = [
    { owner: "org", repo: "app", path: "src/auth.ts", confidence: 0.9 },
    { owner: "org", repo: "app", path: "src/db.ts", confidence: 0.6 },
    { owner: "org", repo: "app", path: "src/ui.ts", confidence: 0.3 },
  ];

  it("fetches top-N by confidence", async () => {
    const adapter = makeFileAdapter("export function auth() {}");
    const files = await fetchTopFiles(candidates, adapter, 2);
    expect(files).toHaveLength(2);
    // Highest confidence files
    expect(files.map((f) => f.path)).toContain("src/auth.ts");
    expect(files.map((f) => f.path)).toContain("src/db.ts");
  });

  it("skips files exceeding 100KB", async () => {
    const adapter = makeFileAdapter("", 101 * 1024); // 101 KB
    const files = await fetchTopFiles(candidates, adapter, 3);
    expect(files).toHaveLength(0);
  });

  it("skips files that throw without propagating error", async () => {
    const adapter: FileContentAdapter = {
      getFileContent: vi.fn().mockRejectedValue(new Error("Network error")),
    };
    const files = await fetchTopFiles(candidates, adapter, 3);
    expect(files).toHaveLength(0);
  });

  it("truncates content to 8K tokens", async () => {
    // 8K tokens * 4 chars/token = 32KB; provide 40KB content
    const adapter = makeFileAdapter("a".repeat(40 * 1024));
    const files = await fetchTopFiles([candidates[0]!], adapter, 1);
    // truncated to ~32K chars
    expect(files[0]!.content.length).toBeLessThanOrEqual(32_100);
  });
});
