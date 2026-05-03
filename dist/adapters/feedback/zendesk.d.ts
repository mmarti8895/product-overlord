/**
 * ZendeskAdapter — pulls tickets from the Zendesk REST API (task 2.4)
 */
import type { FeedbackAdapter, RawFeedbackItem } from "./index.js";
interface ZendeskConfig {
    subdomain: string;
    email: string;
    token: string;
}
export declare class ZendeskAdapter implements FeedbackAdapter {
    private readonly cfg;
    readonly source: "zendesk";
    constructor(cfg: ZendeskConfig);
    fetchSince(since: string | null): Promise<RawFeedbackItem[]>;
}
export {};
