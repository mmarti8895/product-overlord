/**
 * WebhookFeedbackAdapter — stores items pushed via POST /api/discovery/ingest (task 2.5)
 *
 * Acts as a simple in-memory buffer that is drained by TriageQueue.
 */

import type { FeedbackAdapter, RawFeedbackItem } from "./index.js";

export class WebhookFeedbackAdapter implements FeedbackAdapter {
  readonly source = "webhook" as const;
  private readonly buffer: RawFeedbackItem[] = [];

  /** Called by the POST /api/discovery/ingest route handler. */
  push(item: RawFeedbackItem): void {
    this.buffer.push(item);
  }

  async fetchSince(since: string | null): Promise<RawFeedbackItem[]> {
    const cutoff = since ? new Date(since).getTime() : 0;
    const items = this.buffer.filter((i) => i.created_at > cutoff);
    return items;
  }

  /** Drain items older than a given time (called after successful ingestion). */
  drain(before: number): void {
    const idx = this.buffer.findIndex((i) => i.created_at >= before);
    if (idx > 0) this.buffer.splice(0, idx);
  }
}
