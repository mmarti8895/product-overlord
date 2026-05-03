/**
 * Observability Dashboard (Tasks 6.1 – 6.2)
 *
 * 6.1  Evaluation metrics surfaced to the dashboard:
 *       - readiness classification agreement (per run + trend over time)
 *       - component precision-at-3 (per run + trend over time)
 * 6.2  Promotion queue depth metric + stale-candidate alert (> 7 days unreviewed)
 */

import { getEvalRuns } from "./eval-runner.js";
import { getReflectionQueue } from "./reflection-agent.js";
import { logger } from "../utils/logger.js";
import { forgeInstrumentation } from "../forge/instrumentation.js";

// ---------------------------------------------------------------------------
// 6.1  Evaluation metrics for the observability dashboard
// ---------------------------------------------------------------------------

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
export function getEvalMetricsTrend(): EvalMetricsTrend {
  const runs = getEvalRuns();

  const dataPoints: EvalMetricDataPoint[] = runs.map((r) => ({
    run_id: r.run_id,
    timestamp: r.timestamp,
    classification_agreement: r.classification_agreement,
    precision_at_3: r.precision_at_3,
    regression_detected: r.regression_detected,
  }));

  if (dataPoints.length === 0) {
    return {
      data_points: [],
      latest_classification_agreement: 0,
      latest_precision_at_3: 0,
      latest_regression: false,
      classification_agreement_trend: "stable",
      precision_at_3_trend: "stable",
    };
  }

  const latest = dataPoints[dataPoints.length - 1]!;
  const window = dataPoints.slice(-5); // last 5 runs

  const caFirst = window[0]!.classification_agreement;
  const caLast = window[window.length - 1]!.classification_agreement;
  const p3First = window[0]!.precision_at_3;
  const p3Last = window[window.length - 1]!.precision_at_3;

  const THRESHOLD = 0.02; // 2 pp noise floor

  const classificationAgreementTrend: EvalMetricsTrend["classification_agreement_trend"] =
    caLast - caFirst > THRESHOLD ? "improving"
    : caFirst - caLast > THRESHOLD ? "degrading"
    : "stable";

  const precisionAt3Trend: EvalMetricsTrend["precision_at_3_trend"] =
    p3Last - p3First > THRESHOLD ? "improving"
    : p3First - p3Last > THRESHOLD ? "degrading"
    : "stable";

  return {
    data_points: dataPoints,
    latest_classification_agreement: latest.classification_agreement,
    latest_precision_at_3: latest.precision_at_3,
    latest_regression: latest.regression_detected,
    classification_agreement_trend: classificationAgreementTrend,
    precision_at_3_trend: precisionAt3Trend,
  };
}

// ---------------------------------------------------------------------------
// 6.2  Promotion queue depth metric + stale-candidate alert
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_DAYS = 7;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

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
export function getPromotionQueueMetrics(): PromotionQueueMetrics {
  const queue = getReflectionQueue();
  const now = Date.now();

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  const staleCandidateIds: string[] = [];

  for (const c of queue) {
    if (c.status === "pending") {
      pending++;
      const age = now - new Date(c.created_at).getTime();
      if (age > STALE_THRESHOLD_MS) {
        staleCandidateIds.push(c.candidate_id);
      }
    } else if (c.status === "approved") {
      approved++;
    } else {
      rejected++;
    }
  }

  const staleAlert = staleCandidateIds.length > 0;

  if (staleAlert) {
    logger.warn("promotion_queue_stale_alert", {
      stale_count: staleCandidateIds.length,
      stale_candidate_ids: staleCandidateIds,
      threshold_days: STALE_THRESHOLD_DAYS,
    });
  }

  return {
    total: queue.length,
    pending,
    approved,
    rejected,
    stale_count: staleCandidateIds.length,
    stale_candidate_ids: staleCandidateIds,
    stale_alert: staleAlert,
  };
}

// ---------------------------------------------------------------------------
// 6.4  Rollout gate check
// ---------------------------------------------------------------------------

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
export function checkRolloutGate(opts: {
  permissionBoundaryTestsPassing: boolean;
  shadowReplayRunsReviewed: number;
}): RolloutGateResult {
  const trend = getEvalMetricsTrend();

  const caOk = trend.latest_classification_agreement >= 0.85;
  const p3Ok = trend.latest_precision_at_3 >= 0.80;
  const permOk = opts.permissionBoundaryTestsPassing;
  const shadowOk = opts.shadowReplayRunsReviewed >= 1;

  const gatePass = caOk && p3Ok && permOk && shadowOk;

  if (!gatePass) {
    logger.warn("rollout_gate_fail", {
      classification_agreement_ok: caOk,
      precision_at_3_ok: p3Ok,
      permission_boundary_tests_ok: permOk,
      shadow_replay_reviewed_ok: shadowOk,
      latest_ca_pct: +(trend.latest_classification_agreement * 100).toFixed(1),
      latest_p3_pct: +(trend.latest_precision_at_3 * 100).toFixed(1),
    });
  } else {
    logger.info("rollout_gate_pass", {
      latest_ca_pct: +(trend.latest_classification_agreement * 100).toFixed(1),
      latest_p3_pct: +(trend.latest_precision_at_3 * 100).toFixed(1),
    });
  }

  return {
    gate_pass: gatePass,
    classification_agreement_ok: caOk,
    precision_at_3_ok: p3Ok,
    permission_boundary_tests_ok: permOk,
    shadow_replay_reviewed_ok: shadowOk,
    details: {
      latest_classification_agreement: trend.latest_classification_agreement,
      latest_precision_at_3: trend.latest_precision_at_3,
      shadow_replay_runs_reviewed: opts.shadowReplayRunsReviewed,
    },
  };
}

// ---------------------------------------------------------------------------
// Task 8.3 — LLM / RAG metrics
// ---------------------------------------------------------------------------

export interface LLMMetrics {
  llmCallsTotal: number;
  llmDegradedTotal: number;
  llmDegradedRate: number;
  ragRetrievalLatencyP95Ms: number;
}

/** Returns current LLM call and RAG retrieval metrics from the process-wide instrumentation store. */
export function getLLMMetrics(): LLMMetrics {
  const total = forgeInstrumentation.llmCallsTotal;
  const degraded = forgeInstrumentation.llmDegradedTotal;
  return {
    llmCallsTotal: total,
    llmDegradedTotal: degraded,
    llmDegradedRate: total > 0 ? degraded / total : 0,
    ragRetrievalLatencyP95Ms: forgeInstrumentation.ragRetrievalLatencyP95(),
  };
}

// ---------------------------------------------------------------------------
// Task 8.4 — Degraded-rate alert
// ---------------------------------------------------------------------------

const DEGRADED_RATE_THRESHOLD = 0.1; // >10% degraded calls in last 100 triggers alert

/**
 * Checks whether the LLM degraded-call rate exceeds 10% in the last 100 runs.
 * Emits a `degraded_rate_high` warning log when the threshold is exceeded.
 */
export function checkLLMDegradedRateAlert(windowSize = 100): {
  alert: boolean;
  degradedRate: number;
} {
  const events = forgeInstrumentation.getLLMCallEvents().slice(-windowSize);
  if (events.length === 0) return { alert: false, degradedRate: 0 };

  const degradedCount = events.filter((e) => e.degraded).length;
  const degradedRate = degradedCount / events.length;
  const alert = degradedRate > DEGRADED_RATE_THRESHOLD;

  if (alert) {
    logger.warn("degraded_rate_high", {
      degraded_rate_pct: +(degradedRate * 100).toFixed(1),
      window_size: events.length,
      degraded_count: degradedCount,
    });
  }

  return { alert, degradedRate };
}
