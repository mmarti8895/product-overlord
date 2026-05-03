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
export declare class ForgeInstrumentation {
    private readonly actionMetrics;
    private readonly deepLinkEvents;
    private readonly llmCallEvents;
    private readonly ragRetrievalEvents;
    readonly sseSubscribers: Array<(event: object) => void>;
    private readonly uiActionCounters;
    /** Subscribe to metric events pushed to the SSE stream. Returns unsubscribe fn. */
    subscribeSSE(cb: (event: object) => void): () => void;
    /** Broadcast an event to all current SSE subscribers. */
    broadcastSSE(event: object): void;
    /** Task 13.3 — record a UI panel open or button click for analytics. */
    recordUIAction(panel: string, action: string): void;
    /** Returns a snapshot of all UI action counters. */
    getUIActionCounters(): Record<string, number>;
    recordAction(metric: ForgeActionMetric): void;
    /** Returns a snapshot of all recorded action metrics */
    getActionMetrics(): readonly ForgeActionMetric[];
    /** Error rate for a given action (0–1) */
    errorRate(action: string): number;
    /** P50 latency for a given action in milliseconds */
    p50LatencyMs(action: string): number;
    recordDeepLinkClick(event: DeepLinkClickEvent): void;
    getDeepLinkEvents(): readonly DeepLinkClickEvent[];
    /**
     * Click-through rate: fraction of forge_summary runs that resulted in a
     * deep_link click.  Computed over the last `windowCount` summary events.
     */
    deepLinkClickThroughRate(windowCount?: number): number;
    reset(): void;
    recordLLMCall(event: LLMCallEvent): void;
    getLLMCallEvents(): readonly LLMCallEvent[];
    /** Total LLM calls recorded */
    get llmCallsTotal(): number;
    /** Total degraded LLM calls (no actual API call made) */
    get llmDegradedTotal(): number;
    recordRAGRetrieval(event: RAGRetrievalEvent): void;
    getRAGRetrievalEvents(): readonly RAGRetrievalEvent[];
    /** P95 latency for RAG retrieval in milliseconds */
    ragRetrievalLatencyP95(): number;
}
/** Process-wide singleton */
export declare const forgeInstrumentation: ForgeInstrumentation;
