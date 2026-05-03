/**
 * WebhookMetricsAdapter — buffer for POST /api/outcomes/metrics/ingest (task 2.5)
 */

import type { MetricsIngestionAdapter, RawMetricEvent } from "./index.js";

export class WebhookMetricsAdapter implements MetricsIngestionAdapter {
  readonly source = "webhook" as const;
  private readonly buffer: RawMetricEvent[] = [];

  push(event: RawMetricEvent): void {
    this.buffer.push(event);
  }

  async fetchSince(since: string | null): Promise<RawMetricEvent[]> {
    const cutoff = since ? new Date(since).getTime() : 0;
    return this.buffer.filter((e) => e.occurred_at > cutoff);
  }

  drain(before: number): void {
    const idx = this.buffer.findIndex((e) => e.occurred_at >= before);
    if (idx > 0) this.buffer.splice(0, idx);
  }
}
