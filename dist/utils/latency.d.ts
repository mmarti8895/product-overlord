/**
 * p95 Latency Tracker
 *
 * Collects end-to-end analysis run latencies and computes percentiles.
 * Used for instrumentation task 5.2.
 *
 * Usage:
 *   const timer = latencyTracker.start("board_sweep");
 *   // ... run analysis ...
 *   timer.end();   // records latency and logs p95
 */
export declare class LatencyTracker {
    private readonly samples;
    /** Begin timing an operation. Returns an object with an `end()` method. */
    start(operation: string): {
        end: () => number;
    };
    /**
     * Record a pre-computed latency value directly (task 5.1 — per-branch instrumentation).
     * Use this when you already have a duration (e.g. from Promise.allSettled timing).
     */
    record(operation: string, latencyMs: number): void;
    private _record;
    /** Compute the p95 latency (ms) for a given operation across all recorded samples. */
    p95(operation: string): number;
    /** All recorded sample counts by operation. */
    stats(): Record<string, {
        count: number;
        p50: number;
        p95: number;
        p99: number;
    }>;
    /** Reset samples (useful between test runs). */
    reset(): void;
}
/** Singleton tracker shared across the process. */
export declare const latencyTracker: LatencyTracker;
