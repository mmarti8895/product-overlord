/**
 * Context builder — assembles KT chunks + file contents into a <context> block
 * respecting a 12 K token budget. File content is truncated first, then KT chunks
 * are dropped by lowest similarity score.
 */

import { truncateToTokens } from "../knowledge/chunker.js";
import type { RetrievedChunk } from "../knowledge/types.js";
import type { FetchedFile } from "./file-fetcher.js";

const BUDGET_TOKENS = 12_000;
const CHARS_PER_TOKEN = 4;
const BUDGET_CHARS = BUDGET_TOKENS * CHARS_PER_TOKEN;

export interface BuiltContext {
  contextBlock: string;
  /** Approximate tokens used */
  tokensUsed: number;
}

/**
 * Build a <context> block from KT chunks and fetched file contents,
 * staying within a 12 K token budget. File content is truncated first,
 * then lowest-scoring KT chunks are dropped.
 */
export function buildContext(
  ktChunks: RetrievedChunk[],
  fetchedFiles: FetchedFile[]
): BuiltContext {
  // Sort KT chunks by score descending
  const sortedChunks = [...ktChunks].sort((a, b) => b.score - a.score);

  // Start with file contents section
  const fileParts: string[] = [];
  let usedChars = 0;

  for (const file of fetchedFiles) {
    const header = `### File: ${file.path}\n`;
    const available = BUDGET_CHARS - usedChars - header.length;
    if (available <= 0) break;
    const truncated = truncateToTokens(file.content, Math.floor(available / CHARS_PER_TOKEN));
    fileParts.push(`${header}${truncated}`);
    usedChars += header.length + truncated.length;
  }

  // Then KT chunks (highest score first)
  const ktParts: string[] = [];
  for (const chunk of sortedChunks) {
    const sourceLabel = chunk.url
      ? `URL: ${chunk.url}`
      : chunk.file_path
      ? `File: ${chunk.file_path}`
      : `Source: ${chunk.source_id}`;
    const entry = `[${sourceLabel} | score: ${chunk.score.toFixed(2)}]\n${chunk.text}`;
    if (usedChars + entry.length > BUDGET_CHARS) break;
    ktParts.push(entry);
    usedChars += entry.length;
  }

  const parts: string[] = [];
  if (ktParts.length > 0) {
    parts.push("## Knowledge Base Context\n\n" + ktParts.join("\n\n---\n\n"));
  }
  if (fileParts.length > 0) {
    parts.push("## Relevant Source Files\n\n" + fileParts.join("\n\n"));
  }

  const contextBlock = parts.join("\n\n");
  return {
    contextBlock,
    tokensUsed: Math.ceil(usedChars / CHARS_PER_TOKEN),
  };
}
