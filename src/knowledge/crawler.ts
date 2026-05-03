/**
 * URL crawler — fetches and extracts text from HTML pages.
 * Supports depth 1–3. 30 s timeout per page.
 */

import { parseHtml } from "./parser.js";
import type { ParseResult } from "./parser.js";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_DEPTH = 3;

export interface CrawlResult {
  url: string;
  pages: ParseResult[];
}

/** Crawl a URL to the specified depth, returning text for each page. */
export async function crawlUrl(
  startUrl: string,
  depth: number = 1
): Promise<CrawlResult> {
  const clampedDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
  const visited = new Set<string>();
  const pages: ParseResult[] = [];

  await crawlPage(startUrl, clampedDepth, visited, pages);
  return { url: startUrl, pages };
}

async function crawlPage(
  url: string,
  remainingDepth: number,
  visited: Set<string>,
  pages: ParseResult[]
): Promise<void> {
  if (visited.has(url)) return;
  visited.add(url);

  const html = await fetchWithTimeout(url);
  if (!html) return;

  const parsed = await parseHtml(html, url);
  pages.push(parsed);

  if (remainingDepth <= 1) return;

  // Extract same-origin links
  const links = extractLinks(html, url);
  await Promise.all(
    links.slice(0, 10).map((link) =>
      crawlPage(link, remainingDepth - 1, visited, pages)
    )
  );
}

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractLinks(html: string, base: string): string[] {
  const origin = new URL(base).origin;
  const pattern = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], base).href;
      if (resolved.startsWith(origin)) links.push(resolved);
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...new Set(links)];
}
