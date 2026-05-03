/**
 * Text chunker — 512-token overlapping windows with 64-token overlap.
 * Runs synchronously; caller is responsible for worker thread offload if needed.
 *
 * We approximate tokens as ~4 chars/token (GPT tokeniser average).
 */
export interface TextChunk {
    text: string;
    chunk_index: number;
}
/** Split text into overlapping fixed-size chunks. */
export declare function chunkText(text: string): TextChunk[];
/** Truncate text to approximately maxTokens tokens. */
export declare function truncateToTokens(text: string, maxTokens: number): string;
