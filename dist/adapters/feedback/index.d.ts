/**
 * FeedbackAdapter — common interface + raw item shape (task 2.2)
 */
export interface RawFeedbackItem {
    source_id: string;
    text: string;
    /** Unix timestamp (ms) */
    created_at: number;
    customer_segment: string | null;
    tags: string[];
}
export interface FeedbackAdapter {
    source: "intercom" | "zendesk" | "webhook";
    /** Fetch items newer than `since` (ISO-8601). Returns them in ascending order. */
    fetchSince(since: string | null): Promise<RawFeedbackItem[]>;
}
