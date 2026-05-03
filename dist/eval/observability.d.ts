/**
 * Observability Dashboard (Tasks 6.1 – 6.2)
 *
 * 6.1  Evaluation metrics surfaced to the dashboard:
 *       - readiness classification agreement (per run + trend over time)
 *       - component precision-at-3 (per run + trend over time)
 * 6.2  Promotion queue depth metric + stale-candidate alert (> 7 days unreviewed)
 */
export interface EvalMetricDataPoint {
    run_id: string;
    timestamp: string;
    classification_agreement: number;
    precision_at_3: number;
    regression_detected: boolean;
}
export interface EvalMetricsTrend {
    /** All data points — most recent last */
    data_points: EvalMetricDataPoint[];
    /** Latest classification_agreement (0–1) */
    latest_classification_agreement: number;
    /** Latest precision_at_3 (0–1) */
    latest_precision_at_3: number;
    /** Whether the latest run shows a regression */
    latest_regression: boolean;
    /** Trend direction: positive, negative, or stable (based on last 5 runs) */
    classification_agreement_trend: "improving" | "degrading" | "stable";
    precision_at_3_trend: "improving" | "degrading" | "stable";
}
/** Returns classification agreement and precision-at-3 trends across all eval runs. */
export declare function getEvalMetricsTrend(): EvalMetricsTrend;
export interface PromotionQueueMetrics {
    /** Total candidates in queue */
    total: number;
    /** Candidates awaiting review */
    pending: number;
    /** Candidates already approved */
    approved: number;
    /** Candidates already rejected */
    rejected: number;
    /** Pending candidates older than STALE_THRESHOLD_DAYS */
    stale_count: number;
    /** IDs of stale candidates (for alerting / dashboard highlighting) */
    stale_candidate_ids: string[];
    /** Whether a stale alert should be fired */
    stale_alert: boolean;
}
/** Returns current promotion queue depth metrics and stale-candidate status. */
export declare function getPromotionQueueMetrics(): PromotionQueueMetrics;
export interface RolloutGateResult {
    /** Whether all gates pass */
    gate_pass: boolean;
    classification_agreement_ok: boolean;
    precision_at_3_ok: boolean;
    /** Populated from the permission-boundary test runner (set externally) */
    permission_boundary_tests_ok: boolean;
    /** Whether at least one full shadow-replay run has been stored and reviewed */
    shadow_replay_reviewed_ok: boolean;
    details: Record<string, unknown>;
}
/**
 * Check all rollout gates (task 6.4).
 *
 * - classification agreement ≥ 85%
 * - precision-at-3 ≥ 80%
 * - permission-boundary tests passing (caller must pass in result)
 * - ≥ 1 full shadow-replay run reviewed
 */
export declare function checkRolloutGate(opts: {
    permissionBoundaryTestsPassing: boolean;
    shadowReplayRunsReviewed: number;
}): RolloutGateResult;
export interface LLMMetrics {
    llmCallsTotal: number;
    llmDegradedTotal: number;
    llmDegradedRate: number;
    ragRetrievalLatencyP95Ms: number;
}
/** Returns current LLM call and RAG retrieval metrics from the process-wide instrumentation store. */
export declare function getLLMMetrics(): LLMMetrics;
/**
 * Checks whether the LLM degraded-call rate exceeds 10% in the last 100 runs.
 * Emits a `degraded_rate_high` warning log when the threshold is exceeded.
 */
export declare function checkLLMDegradedRateAlert(windowSize?: number): {
    alert: boolean;
    degradedRate: number;
};
