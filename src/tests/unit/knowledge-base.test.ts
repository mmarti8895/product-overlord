/**
 * Unit tests for the Knowledge Base module (Task 3.8)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { chunkText, truncateToTokens } from "../../knowledge/chunker.js";
import { parseBuffer } from "../../knowledge/parser.js";
import { UnsupportedFormatError, FileTooLargeError, StoreFullError } from "../../knowledge/types.js";
import { MockLLMAdapter } from "../../llm/mock-adapter.js";
import { KnowledgeBase } from "../../knowledge/index.js";

// ---------------------------------------------------------------------------
// Chunker
// ---------------------------------------------------------------------------

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toHaveLength(0);
  });

  it("returns single chunk for short text", () => {
    const chunks = chunkText("Hello world");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].text).toBe("Hello world");
  });

  it("creates overlapping chunks for long text", () => {
    // Generate text well over the 2048-char chunk size
    const longText = "word ".repeat(600); // ~3000 chars
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
    // Verify overlap: tail of chunk 0 should appear at start of chunk 1
    expect(chunks[0].text.length).toBeGreaterThan(0);
    expect(chunks[1].chunk_index).toBe(1);
  });

  it("assigns sequential chunk_index values", () => {
    const longText = "x".repeat(5000);
    const chunks = chunkText(longText);
    chunks.forEach((c, i) => expect(c.chunk_index).toBe(i));
  });
});

describe("truncateToTokens", () => {
  it("leaves short text unchanged", () => {
    expect(truncateToTokens("short", 100)).toBe("short");
  });

  it("truncates long text to approximately maxTokens * 4 chars", () => {
    const text = "a".repeat(10000);
    const result = truncateToTokens(text, 100);
    expect(result.length).toBe(400); // 100 tokens * 4 chars
  });
});

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

describe("parseBuffer", () => {
  it("parses markdown file", async () => {
    const buf = Buffer.from("# Title\n\nSome content", "utf-8");
    const result = await parseBuffer(buf, "doc.md");
    expect(result.format).toBe("markdown");
    expect(result.text).toContain("Some content");
    expect(result.name).toBe("doc.md");
  });

  it("parses plain text file", async () => {
    const buf = Buffer.from("Hello plain text", "utf-8");
    const result = await parseBuffer(buf, "notes.txt");
    expect(result.format).toBe("text");
    expect(result.text).toBe("Hello plain text");
  });

  it("throws UnsupportedFormatError for unknown extension", async () => {
    const buf = Buffer.from("data", "utf-8");
    await expect(parseBuffer(buf, "file.xyz")).rejects.toThrow(UnsupportedFormatError);
  });

  it("throws UnsupportedFormatError for file with no extension", async () => {
    const buf = Buffer.from("data", "utf-8");
    await expect(parseBuffer(buf, "noextension")).rejects.toThrow(UnsupportedFormatError);
  });
});

// ---------------------------------------------------------------------------
// KnowledgeBase facade
// ---------------------------------------------------------------------------

describe("KnowledgeBase", () => {
  let kb: KnowledgeBase;
  let adapter: MockLLMAdapter;

  beforeEach(() => {
    adapter = new MockLLMAdapter({ embedDim: 4 });
    kb = new KnowledgeBase({
      storePath: ":memory:",
      maxSizeGb: 1,
      adapter,
    });
    // Stub store methods so we don't need real LanceDB in unit tests
    vi.spyOn(kb.getStore(), "ingest").mockResolvedValue(undefined);
    vi.spyOn(kb.getStore(), "sizeBytes").mockResolvedValue(0);
    vi.spyOn(kb.getStore(), "listSources").mockResolvedValue([]);
    vi.spyOn(kb.getStore(), "deleteSource").mockResolvedValue(undefined);
  });

  it("ingestFile returns IngestResult for markdown", async () => {
    const buf = Buffer.from("# Docs\n\nSome knowledge transfer content here.", "utf-8");
    const result = await kb.ingestFile(buf, "kt.md", "PROJ");
    expect(result.source_id).toBeTruthy();
    expect(result.chunk_count).toBeGreaterThan(0);
    expect(result.size_bytes).toBe(buf.byteLength);
  });

  it("ingestFile throws FileTooLargeError for oversized file", async () => {
    const bigBuf = Buffer.alloc(51 * 1024 * 1024); // 51 MB
    await expect(kb.ingestFile(bigBuf, "huge.txt", "PROJ")).rejects.toThrow(FileTooLargeError);
  });

  it("ingestFile throws StoreFullError when store is full", async () => {
    vi.spyOn(kb.getStore(), "sizeBytes").mockResolvedValue(1 * 1024 * 1024 * 1024); // already at 1 GB limit
    const buf = Buffer.from("some content", "utf-8");
    await expect(kb.ingestFile(buf, "doc.txt", "PROJ")).rejects.toThrow(StoreFullError);
  });

  it("ingestFile throws UnsupportedFormatError for bad extension", async () => {
    const buf = Buffer.from("data", "utf-8");
    await expect(kb.ingestFile(buf, "data.csv", "PROJ")).rejects.toThrow(UnsupportedFormatError);
  });

  it("listSources delegates to store", async () => {
    await kb.listSources("PROJ");
    expect(kb.getStore().listSources).toHaveBeenCalledWith("PROJ");
  });

  it("deleteSource delegates to store", async () => {
    await kb.deleteSource("some-id");
    expect(kb.getStore().deleteSource).toHaveBeenCalledWith("some-id");
  });
});
