/**
 * URL crawler — fetches and extracts text from HTML pages.
 * Supports depth 1–3. 30 s timeout per page.
 */
import type { ParseResult } from "./parser.js";
export interface CrawlResult {
    url: string;
    pages: ParseResult[];
}
/** Crawl a URL to the specified depth, returning text for each page. */
export declare function crawlUrl(startUrl: string, depth?: number): Promise<CrawlResult>;
