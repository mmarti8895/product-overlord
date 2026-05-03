/**
 * WebhookFeedbackAdapter — stores items pushed via POST /api/discovery/ingest (task 2.5)
 *
 * Acts as a simple in-memory buffer that is drained by TriageQueue.
 */
import type { FeedbackAdapter, RawFeedbackItem } from "./index.js";
export declare class WebhookFeedbackAdapter implements FeedbackAdapter {
    readonly source: "webhook";
    private readonly buffer;
    /** Called by the POST /api/discovery/ingest route handler. */
    push(item: RawFeedbackItem): void;
    fetchSince(since: string | null): Promise<RawFeedbackItem[]>;
    /** Drain items older than a given time (called after successful ingestion). */
    drain(before: number): void;
}
