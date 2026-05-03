/**
 * URL crawler — fetches and extracts text from HTML pages.
 * Supports depth 1–3. 30 s timeout per page.
 */
import { parseHtml } from "./parser.js";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_DEPTH = 3;
/** Crawl a URL to the specified depth, returning text for each page. */
export async function crawlUrl(startUrl, depth = 1) {
    const clampedDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
    const visited = new Set();
    const pages = [];
    await crawlPage(startUrl, clampedDepth, visited, pages);
    return { url: startUrl, pages };
}
async function crawlPage(url, remainingDepth, visited, pages) {
    if (visited.has(url))
        return;
    visited.add(url);
    const html = await fetchWithTimeout(url);
    if (!html)
        return;
    const parsed = await parseHtml(html, url);
    pages.push(parsed);
    if (remainingDepth <= 1)
        return;
    // Extract same-origin links
    const links = extractLinks(html, url);
    await Promise.all(links.slice(0, 10).map((link) => crawlPage(link, remainingDepth - 1, visited, pages)));
}
async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok)
            return null;
        return await res.text();
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
function extractLinks(html, base) {
    const origin = new URL(base).origin;
    const pattern = /href=["']([^"']+)["']/gi;
    const links = [];
    let match;
    while ((match = pattern.exec(html)) !== null) {
        try {
            const resolved = new URL(match[1], base).href;
            if (resolved.startsWith(origin))
                links.push(resolved);
        }
        catch {
            // ignore malformed hrefs
        }
    }
    return [...new Set(links)];
}
