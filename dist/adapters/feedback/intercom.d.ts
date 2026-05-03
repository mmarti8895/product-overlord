/**
 * IntercomAdapter — pulls conversations from the Intercom REST API (task 2.3)
 */
import type { FeedbackAdapter, RawFeedbackItem } from "./index.js";
interface IntercomConfig {
    token: string;
    baseUrl?: string;
}
export declare class IntercomAdapter implements FeedbackAdapter {
    private readonly cfg;
    readonly source: "intercom";
    private readonly baseUrl;
    constructor(cfg: IntercomConfig);
    fetchSince(since: string | null): Promise<RawFeedbackItem[]>;
}
export {};
