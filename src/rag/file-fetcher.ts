/**
 * RAG file fetcher — fetches actual GitHub file contents for the top-N
 * highest-confidence candidate files from the repo adapter.
 * Enforces 100 KB per file and 8 K token truncation.
 */

import { truncateToTokens } from "../knowledge/chunker.js";
import type { AdapterTrace } from "../types/index.js";

const FILE_SIZE_LIMIT_BYTES = 100 * 1024; // 100 KB
const MAX_TOKENS_PER_FILE = 8_000;

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
  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; trace: AdapterTrace }>;
}

/**
 * Fetch the top-N highest-confidence candidate files.
 * Skips files that fail or are too large; never throws.
 */
export async function fetchTopFiles(
  candidates: CandidateRef[],
  adapter: FileContentAdapter,
  topN: number = 3
): Promise<FetchedFile[]> {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, topN);
  const results: FetchedFile[] = [];

  await Promise.all(
    sorted.map(async (c) => {
      try {
        const { content, trace } = await adapter.getFileContent(c.owner, c.repo, c.path, c.ref);
        if (Buffer.byteLength(content, "utf-8") > FILE_SIZE_LIMIT_BYTES) {
          return; // skip — too large
        }
        results.push({
          path: c.path,
          content: truncateToTokens(content, MAX_TOKENS_PER_FILE),
          trace,
        });
      } catch {
        // log nothing — file fetch failures are non-fatal
      }
    })
  );

  return results;
}
