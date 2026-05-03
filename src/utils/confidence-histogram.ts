/**
 * Confidence Histogram
 *
 * Records repo-mapper confidence scores and buckets them into a histogram
 * for observability (task 5.2).
 *
 * Buckets: [0,0.1), [0.1,0.2), ..., [0.9,1.0], overflow ≥ 1.0
 *
 * Usage:
 *   confidenceHistogram.record(result.candidate_components[0]?.confidence ?? 0);
 *   confidenceHistogram.snapshot(); // → { "0.0-0.1": 3, "0.1-0.2": 1, ... }
 */

import { logger } from "./logger.js";

// ---------------------------------------------------------------------------
// Bucket boundaries
// ---------------------------------------------------------------------------

const BUCKET_COUNT = 10; // 10 buckets: 0.0–0.1, 0.1–0.2, ..., 0.9–1.0

function bucketLabel(i: number): string {
  const lo = (i / BUCKET_COUNT).toFixed(1);
  const hi = ((i + 1) / BUCKET_COUNT).toFixed(1);
  return `${lo}-${hi}`;
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

export class ConfidenceHistogram {
  private readonly buckets: number[] = new Array(BUCKET_COUNT + 1).fill(0);
  private total = 0;

  /**
   * Record a confidence value (0.0–1.0).
   * Values outside this range are clamped.
   */
  record(confidence: number, operation = "repo-mapper"): void {
    const clamped = Math.max(0, Math.min(1, confidence));
    const idx = clamped >= 1.0 ? BUCKET_COUNT - 1 : Math.floor(clamped * BUCKET_COUNT);
    this.buckets[idx]++;
    this.total++;

    logger.info("confidence_sample", {
      operation,
      confidence: parseFloat(clamped.toFixed(3)),
      bucket: bucketLabel(idx),
      total_samples: this.total,
    });
  }

  /**
   * Return the current histogram snapshot as a label→count map.
   */
  snapshot(): Record<string, number> {
    const result: Record<string, number> = {};
    for (let i = 0; i < BUCKET_COUNT; i++) {
      result[bucketLabel(i)] = this.buckets[i];
    }
    return result;
  }

  /** Total number of samples recorded. */
  get sampleCount(): number {
    return this.total;
  }

  /** Reset all buckets (useful between test runs). */
  reset(): void {
    this.buckets.fill(0);
    this.total = 0;
  }
}

/** Singleton histogram shared across the process. */
export const confidenceHistogram = new ConfidenceHistogram();
