/**
 * Forge Instrumentation
 *
 * Tasks 6.1 – 6.2, 8.1 – 8.2
 *
 * Collects Forge action latency / error-rate metrics, deep_link
 * click-through events, LLM call events, and RAG retrieval events.
 * All data is kept in-process and designed to be flushed to an external
 * metrics sink without changing callers.
 */

import type { ForgeActionMetric, DeepLinkClickEvent } from "./types.js";

// ---------------------------------------------------------------------------
// LLM / RAG event types (Task 8.1 – 8.2)
// ---------------------------------------------------------------------------

export interface LLMCallEvent {
  timestamp: string;
  model: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  degraded: boolean;
  reason?: string;
}

export interface RAGRetrievalEvent {
  timestamp: string;
  project_key: string;
  chunk_count: number;
  latency_ms: number;
  timeout: boolean;
}

// ---------------------------------------------------------------------------
// Metrics store
// ---------------------------------------------------------------------------

export class ForgeInstrumentation {
  private readonly actionMetrics: ForgeActionMetric[] = [];
  private readonly deepLinkEvents: DeepLinkClickEvent[] = [];
  private readonly llmCallEvents: LLMCallEvent[] = [];
  private readonly ragRetrievalEvents: RAGRetrievalEvent[] = [];

  // Task 13.2 — SSE subscriber list for /api/metrics fan-out
  readonly sseSubscribers: Array<(event: object) => void> = [];

  // Task 13.3 — UI action counters
  private readonly uiActionCounters: Map<string, number> = new Map();

  /** Subscribe to metric events pushed to the SSE stream. Returns unsubscribe fn. */
  subscribeSSE(cb: (event: object) => void): () => void {
    this.sseSubscribers.push(cb);
    return () => {
      const idx = this.sseSubscribers.indexOf(cb);
      if (idx !== -1) this.sseSubscribers.splice(idx, 1);
    };
  }

  /** Broadcast an event to all current SSE subscribers. */
  broadcastSSE(event: object): void {
    for (const sub of this.sseSubscribers) {
      try { sub(event); } catch { /* swallow */ }
    }
  }

  /** Task 13.3 — record a UI panel open or button click for analytics. */
  recordUIAction(panel: string, action: string): void {
    const key = `${panel}:${action}`;
    this.uiActionCounters.set(key, (this.uiActionCounters.get(key) ?? 0) + 1);
  }

  /** Returns a snapshot of all UI action counters. */
  getUIActionCounters(): Record<string, number> {
    return Object.fromEntries(this.uiActionCounters.entries());
  }

  // ── Action metrics (task 6.1) ────────────────────────────────────────────

  recordAction(metric: ForgeActionMetric): void {
    this.actionMetrics.push(metric);
    this.broadcastSSE({ type: "forge_action", ...metric });
  }

  /** Returns a snapshot of all recorded action metrics */
  getActionMetrics(): readonly ForgeActionMetric[] {
    return this.actionMetrics;
  }

  /** Error rate for a given action (0–1) */
  errorRate(action: string): number {
    const relevant = this.actionMetrics.filter((m) => m.action === action);
    if (relevant.length === 0) return 0;
    const errors = relevant.filter((m) => m.status === "error").length;
    return errors / relevant.length;
  }

  /** P50 latency for a given action in milliseconds */
  p50LatencyMs(action: string): number {
    const latencies = this.actionMetrics
      .filter((m) => m.action === action)
      .map((m) => m.latency_ms)
      .sort((a, b) => a - b);
    if (latencies.length === 0) return 0;
    return latencies[Math.floor(latencies.length / 2)]!;
  }

  // ── Deep-link click-through (task 6.2) ───────────────────────────────────

  recordDeepLinkClick(event: DeepLinkClickEvent): void {
    this.deepLinkEvents.push(event);
  }

  getDeepLinkEvents(): readonly DeepLinkClickEvent[] {
    return this.deepLinkEvents;
  }

  /**
   * Click-through rate: fraction of forge_summary runs that resulted in a
   * deep_link click.  Computed over the last `windowCount` summary events.
   */
  deepLinkClickThroughRate(windowCount = 100): number {
    const summaryClicks = this.deepLinkEvents
      .filter((e) => e.source === "forge_summary")
      .slice(-windowCount);
    const summaryRuns = this.actionMetrics
      .filter((m) => m.action === "analyse_ticket")
      .slice(-windowCount);
    if (summaryRuns.length === 0) return 0;
    return summaryClicks.length / summaryRuns.length;
  }

  reset(): void {
    this.actionMetrics.length = 0;
    this.deepLinkEvents.length = 0;
    this.llmCallEvents.length = 0;
    this.ragRetrievalEvents.length = 0;
    // Task 13.1 — also clear SSE subscriber list on reset (test teardown)
    this.sseSubscribers.length = 0;
    // Task 13.3 — clear UI action counters
    this.uiActionCounters.clear();
  }

  // ── LLM call events (Task 8.1) ───────────────────────────────────────────

  recordLLMCall(event: LLMCallEvent): void {
    this.llmCallEvents.push(event);
    this.broadcastSSE({ type: "llm_call", ...event });
  }

  getLLMCallEvents(): readonly LLMCallEvent[] {
    return this.llmCallEvents;
  }

  /** Total LLM calls recorded */
  get llmCallsTotal(): number {
    return this.llmCallEvents.length;
  }

  /** Total degraded LLM calls (no actual API call made) */
  get llmDegradedTotal(): number {
    return this.llmCallEvents.filter((e) => e.degraded).length;
  }

  // ── RAG retrieval events (Task 8.2) ──────────────────────────────────────

  recordRAGRetrieval(event: RAGRetrievalEvent): void {
    this.ragRetrievalEvents.push(event);
    this.broadcastSSE({ type: "rag_retrieval", ...event });
  }

  getRAGRetrievalEvents(): readonly RAGRetrievalEvent[] {
    return this.ragRetrievalEvents;
  }

  /** P95 latency for RAG retrieval in milliseconds */
  ragRetrievalLatencyP95(): number {
    const latencies = this.ragRetrievalEvents.map((e) => e.latency_ms).sort((a, b) => a - b);
    if (latencies.length === 0) return 0;
    const idx = Math.ceil(latencies.length * 0.95) - 1;
    return latencies[Math.max(0, idx)]!;
  }
}

/** Process-wide singleton */
export const forgeInstrumentation = new ForgeInstrumentation();
