/**
 * PortfolioDigestWriter — generates Markdown digest and delivers to Slack + Confluence (task 2.6)
 */
import type { LLMAdapter } from "../llm/types.js";
import type { PortfolioSnapshot, PortfolioDigest, DeliveryRecord } from "../types/portfolio.js";
interface DigestConfig {
    slackWebhookUrl?: string;
    confluenceBaseUrl?: string;
    confluenceToken?: string;
    confluenceSpaceKey?: string;
}
export declare class PortfolioDigestWriter {
    private readonly llm;
    private readonly cfg;
    constructor(llm: LLMAdapter, cfg: DigestConfig);
    generate(snapshot: PortfolioSnapshot): Promise<PortfolioDigest>;
    deliverToSlack(digest: PortfolioDigest): Promise<DeliveryRecord>;
    deliverToConfluence(digest: PortfolioDigest): Promise<DeliveryRecord>;
}
export {};
