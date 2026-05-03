/**
 * WebhookFeedbackAdapter — stores items pushed via POST /api/discovery/ingest (task 2.5)
 *
 * Acts as a simple in-memory buffer that is drained by TriageQueue.
 */
export class WebhookFeedbackAdapter {
    source = "webhook";
    buffer = [];
    /** Called by the POST /api/discovery/ingest route handler. */
    push(item) {
        this.buffer.push(item);
    }
    async fetchSince(since) {
        const cutoff = since ? new Date(since).getTime() : 0;
        const items = this.buffer.filter((i) => i.created_at > cutoff);
        return items;
    }
    /** Drain items older than a given time (called after successful ingestion). */
    drain(before) {
        const idx = this.buffer.findIndex((i) => i.created_at >= before);
        if (idx > 0)
            this.buffer.splice(0, idx);
    }
}
