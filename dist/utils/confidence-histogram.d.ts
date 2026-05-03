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
export declare class ConfidenceHistogram {
    private readonly buckets;
    private total;
    /**
     * Record a confidence value (0.0–1.0).
     * Values outside this range are clamped.
     */
    record(confidence: number, operation?: string): void;
    /**
     * Return the current histogram snapshot as a label→count map.
     */
    snapshot(): Record<string, number>;
    /** Total number of samples recorded. */
    get sampleCount(): number;
    /** Reset all buckets (useful between test runs). */
    reset(): void;
}
/** Singleton histogram shared across the process. */
export declare const confidenceHistogram: ConfidenceHistogram;
