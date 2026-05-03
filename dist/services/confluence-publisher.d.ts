/**
 * ConfluencePublisher — converts PRD Markdown to Confluence XHTML and
 * creates/updates pages. Returns a diff between previous and new content. (task 2.4)
 */
import type { PRDDraft, PRDDiff } from "../types/prd.js";
interface ConfluenceConfig {
    baseUrl: string;
    token: string;
    spaceKey: string;
}
export declare class ConfluencePublisher {
    private readonly cfg;
    constructor(cfg: ConfluenceConfig);
    private get headers();
    publish(draft: PRDDraft): Promise<{
        url: string;
        diff: PRDDiff;
    }>;
}
export {};
