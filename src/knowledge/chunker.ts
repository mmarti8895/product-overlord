/**
 * Text chunker — 512-token overlapping windows with 64-token overlap.
 * Runs synchronously; caller is responsible for worker thread offload if needed.
 *
 * We approximate tokens as ~4 chars/token (GPT tokeniser average).
 */

const CHUNK_TOKENS = 512;
const OVERLAP_TOKENS = 64;
const CHARS_PER_TOKEN = 4;

const CHUNK_CHARS = CHUNK_TOKENS * CHARS_PER_TOKEN;   // 2048
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // 256

export interface TextChunk {
  text: string;
  chunk_index: number;
}

/** Split text into overlapping fixed-size chunks. */
export function chunkText(text: string): TextChunk[] {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  if (!normalised) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalised.length) {
    const end = Math.min(start + CHUNK_CHARS, normalised.length);
    const slice = normalised.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({ text: slice, chunk_index: index++ });
    }
    if (end >= normalised.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}

/** Truncate text to approximately maxTokens tokens. */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}
