/**
 * PortfolioDigestWriter — generates Markdown digest and delivers to Slack + Confluence (task 2.6)
 */
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
const DIGEST_SCHEMA = {
    type: "object",
    properties: { markdown: { type: "string" } },
    required: ["markdown"],
};
export class PortfolioDigestWriter {
    llm;
    cfg;
    constructor(llm, cfg) {
        this.llm = llm;
        this.cfg = cfg;
    }
    async generate(snapshot) {
        const projectLines = snapshot.projects
            .map((p) => `- **${p.project_key}**: health ${p.health_score}%, velocity ${p.velocity_pct}%, at-risk epics: ${p.at_risk_epics}`)
            .join("\n");
        const depCount = snapshot.dependencies.length;
        const prompt = `You are a portfolio manager. Write a concise Markdown portfolio digest (≤4 paragraphs) covering:\n` +
            `- Overall health\n- Key risks\n- Cross-team dependencies (count: ${depCount})\n- Recommended actions\n\n` +
            `Projects:\n${projectLines}`;
        let markdown = `# Portfolio Digest\n\nGenerated at ${snapshot.generated_at}\n\n${projectLines}`;
        try {
            const { result } = await this.llm.complete(prompt, DIGEST_SCHEMA);
            markdown = result.markdown;
        }
        catch { /* use fallback */ }
        return {
            portfolio_id: snapshot.portfolio_id,
            generated_at: new Date().toISOString(),
            markdown,
            projects: snapshot.projects,
        };
    }
    async deliverToSlack(digest) {
        const record = {
            id: randomUUID(),
            portfolio_id: digest.portfolio_id,
            channel: "slack",
            delivered_at: new Date().toISOString(),
            success: false,
            error: null,
        };
        if (!this.cfg.slackWebhookUrl) {
            record.error = "slackWebhookUrl not configured";
            return record;
        }
        try {
            const resp = await fetch(this.cfg.slackWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: digest.markdown }),
            });
            if (!resp.ok)
                throw new Error(`Slack HTTP ${resp.status}`);
            record.success = true;
            logger.info("portfolio: digest delivered to Slack", { portfolio_id: digest.portfolio_id });
        }
        catch (e) {
            record.error = e instanceof Error ? e.message : String(e);
        }
        return record;
    }
    async deliverToConfluence(digest) {
        const record = {
            id: randomUUID(),
            portfolio_id: digest.portfolio_id,
            channel: "confluence",
            delivered_at: new Date().toISOString(),
            success: false,
            error: null,
        };
        if (!this.cfg.confluenceBaseUrl || !this.cfg.confluenceToken || !this.cfg.confluenceSpaceKey) {
            record.error = "Confluence not configured";
            return record;
        }
        try {
            const xhtml = `<p>${digest.markdown.replace(/\n/g, "</p><p>")}</p>`;
            const body = {
                type: "page",
                title: `Portfolio Digest — ${digest.generated_at.slice(0, 10)}`,
                space: { key: this.cfg.confluenceSpaceKey },
                body: { storage: { value: xhtml, representation: "storage" } },
            };
            const resp = await fetch(`${this.cfg.confluenceBaseUrl}/rest/api/content`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.cfg.confluenceToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            if (!resp.ok)
                throw new Error(`Confluence HTTP ${resp.status}`);
            record.success = true;
            logger.info("portfolio: digest delivered to Confluence", { portfolio_id: digest.portfolio_id });
        }
        catch (e) {
            record.error = e instanceof Error ? e.message : String(e);
        }
        return record;
    }
}
