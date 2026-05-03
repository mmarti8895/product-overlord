/**
 * RAG file fetcher — fetches actual GitHub file contents for the top-N
 * highest-confidence candidate files from the repo adapter.
 * Enforces 100 KB per file and 8 K token truncation.
 */
import type { AdapterTrace } from "../types/index.js";
export interface FetchedFile {
    path: string;
    content: string;
    trace: AdapterTrace;
}
export interface CandidateRef {
    owner: string;
    repo: string;
    path: string;
    confidence: number;
    ref?: string;
}
export interface FileContentAdapter {
    getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<{
        content: string;
        trace: AdapterTrace;
    }>;
}
/**
 * Fetch the top-N highest-confidence candidate files.
 * Skips files that fail or are too large; never throws.
 */
export declare function fetchTopFiles(candidates: CandidateRef[], adapter: FileContentAdapter, topN?: number): Promise<FetchedFile[]>;
