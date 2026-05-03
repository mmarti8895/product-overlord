/**
 * WebhookMetricsAdapter — buffer for POST /api/outcomes/metrics/ingest (task 2.5)
 */
import type { MetricsIngestionAdapter, RawMetricEvent } from "./index.js";
export declare class WebhookMetricsAdapter implements MetricsIngestionAdapter {
    readonly source: "webhook";
    private readonly buffer;
    push(event: RawMetricEvent): void;
    fetchSince(since: string | null): Promise<RawMetricEvent[]>;
    drain(before: number): void;
}
