/**
 * ConfluencePublisher — converts PRD Markdown to Confluence XHTML and
 * creates/updates pages. Returns a diff between previous and new content. (task 2.4)
 */
import { logger } from "../utils/logger.js";
function markdownToXhtml(md) {
    // Minimal conversion: paragraphs + headings + bold
    return md
        .split("\n\n")
        .map((block) => {
        const h = block.match(/^(#{1,4})\s+(.*)/);
        if (h) {
            const level = Math.min(h[1].length, 4);
            return `<h${level}>${h[2]}</h${level}>`;
        }
        const line = block
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/\n/g, "<br/>");
        return `<p>${line}</p>`;
    })
        .join("\n");
}
export class ConfluencePublisher {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    get headers() {
        return {
            Authorization: `Bearer ${this.cfg.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    async publish(draft) {
        const xhtml = draft.content.sections
            .sort((a, b) => a.order - b.order)
            .map((s) => `<h2>${s.heading}</h2>\n${markdownToXhtml(s.body)}`)
            .join("\n");
        // Check if a page with the same title exists
        const searchResp = await fetch(`${this.cfg.baseUrl}/rest/api/content?spaceKey=${this.cfg.spaceKey}&title=${encodeURIComponent(draft.title)}&expand=body.storage,version`, { headers: this.headers });
        let existingId = null;
        let existingVersion = 0;
        let beforeXhtml = "";
        if (searchResp.ok) {
            const data = (await searchResp.json());
            if (data.results.length > 0) {
                existingId = data.results[0].id;
                existingVersion = data.results[0].version.number;
                beforeXhtml = data.results[0].body?.storage?.value ?? "";
            }
        }
        const payload = {
            type: "page",
            title: draft.title,
            space: { key: this.cfg.spaceKey },
            version: existingId ? { number: existingVersion + 1 } : undefined,
            body: {
                storage: { value: xhtml, representation: "storage" },
            },
        };
        let pageUrl = "";
        if (existingId) {
            const resp = await fetch(`${this.cfg.baseUrl}/rest/api/content/${existingId}`, {
                method: "PUT",
                headers: this.headers,
                body: JSON.stringify(payload),
            });
            if (!resp.ok)
                throw new Error(`Confluence update failed: ${resp.status}`);
            const data = (await resp.json());
            pageUrl = `${this.cfg.baseUrl}${data._links.webui}`;
        }
        else {
            const resp = await fetch(`${this.cfg.baseUrl}/rest/api/content`, {
                method: "POST",
                headers: this.headers,
                body: JSON.stringify(payload),
            });
            if (!resp.ok)
                throw new Error(`Confluence create failed: ${resp.status}`);
            const data = (await resp.json());
            pageUrl = `${this.cfg.baseUrl}${data._links.webui}`;
        }
        logger.info("prd: published to Confluence", { draft_id: draft.id, pageUrl });
        return { url: pageUrl, diff: { before: beforeXhtml, after: xhtml } };
    }
}
