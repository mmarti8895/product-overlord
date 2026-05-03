/**
 * WebhookMetricsAdapter — buffer for POST /api/outcomes/metrics/ingest (task 2.5)
 */
export class WebhookMetricsAdapter {
    source = "webhook";
    buffer = [];
    push(event) {
        this.buffer.push(event);
    }
    async fetchSince(since) {
        const cutoff = since ? new Date(since).getTime() : 0;
        return this.buffer.filter((e) => e.occurred_at > cutoff);
    }
    drain(before) {
        const idx = this.buffer.findIndex((e) => e.occurred_at >= before);
        if (idx > 0)
            this.buffer.splice(0, idx);
    }
}
