/**
 * Context builder — assembles KT chunks + file contents into a <context> block
 * respecting a 12 K token budget. File content is truncated first, then KT chunks
 * are dropped by lowest similarity score.
 */
import type { RetrievedChunk } from "../knowledge/types.js";
import type { FetchedFile } from "./file-fetcher.js";
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
export declare function buildContext(ktChunks: RetrievedChunk[], fetchedFiles: FetchedFile[]): BuiltContext;
