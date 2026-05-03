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

import { logger } from "./logger.js";

// ---------------------------------------------------------------------------
// Tracker
// ---------------------------------------------------------------------------

export class LatencyTracker {
  private readonly samples: Map<string, number[]> = new Map();

  /** Begin timing an operation. Returns an object with an `end()` method. */
  start(operation: string): { end: () => number } {
    const t0 = Date.now();
    return {
      end: () => {
        const latencyMs = Date.now() - t0;
        this._record(operation, latencyMs);
        return latencyMs;
      },
    };
  }

  /**
   * Record a pre-computed latency value directly (task 5.1 — per-branch instrumentation).
   * Use this when you already have a duration (e.g. from Promise.allSettled timing).
   */
  record(operation: string, latencyMs: number): void {
    this._record(operation, latencyMs);
  }

  private _record(operation: string, latencyMs: number): void {
    if (!this.samples.has(operation)) {
      this.samples.set(operation, []);
    }
    this.samples.get(operation)!.push(latencyMs);

    const p95 = this.p95(operation);
    logger.info("latency_sample", { operation, latencyMs, p95_ms: p95, n: this.samples.get(operation)!.length });
  }

  /** Compute the p95 latency (ms) for a given operation across all recorded samples. */
  p95(operation: string): number {
    const data = this.samples.get(operation);
    if (!data || data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  }

  /** All recorded sample counts by operation. */
  stats(): Record<string, { count: number; p50: number; p95: number; p99: number }> {
    const result: Record<string, { count: number; p50: number; p95: number; p99: number }> = {};
    for (const [op, data] of this.samples) {
      const sorted = [...data].sort((a, b) => a - b);
      const pct = (p: number) => {
        const idx = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, idx)];
      };
      result[op] = { count: sorted.length, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99) };
    }
    return result;
  }

  /** Reset samples (useful between test runs). */
  reset(): void {
    this.samples.clear();
  }
}

/** Singleton tracker shared across the process. */
export const latencyTracker = new LatencyTracker();
