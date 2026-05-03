/**
 * Evaluation Runner (Tasks 1.4 – 1.7)
 *
 * Loads the gold set → runs each entry through shadow-mode analysis (no Jira
 * writes) → compares outputs vs. human labels → computes metrics → fires a
 * regression alert if any metric drops > 5 pp vs. the previous run →
 * persists each eval run with full per-entry results.
 *
 * All analysis is read-only (shadow mode enforced by the normaliser +
 * scorer path; no confirm endpoint called).
 */
import type { ReadinessResult } from "../types/index.js";
export interface EvalEntryResult {
    /** Gold-set entry id */
    entry_id: string;
    /** Actual readiness verdict produced */
    actual_readiness_status: string;
    /** Expected readiness verdict */
    expected_readiness_status: string;
    /** Whether readiness classification agreed */
    readiness_correct: boolean;
    /** Expected top-component names */
    expected_top_components: string[];
    /**
     * Actual top components returned (from action package or empty if
     * component index unavailable in shadow mode).
     */
    actual_top_components: string[];
    /** precision@3: fraction of expected top-3 comps found in actual top-3 */
    precision_at_3: number;
    /** Full readiness result for drill-down */
    readiness_result: ReadinessResult;
    error?: string;
}
export interface EvalRun {
    /** Stable UUID for this eval run */
    run_id: string;
    /** ISO-8601 */
    timestamp: string;
    /** Semver or git SHA of the engine */
    schema_version: string;
    /** Total entries attempted */
    total: number;
    /** Entries that errored */
    errors: number;
    per_entry_results: EvalEntryResult[];
    /** Readiness classification agreement (0–1) */
    classification_agreement: number;
    /** Component precision-at-3 averaged across entries with expected_top_components */
    precision_at_3: number;
    /** Regression vs. previous run: true = regression detected */
    regression_detected: boolean;
    /** pp change in classification_agreement vs. previous run (negative = regression) */
    classification_agreement_delta?: number;
    /** pp change in precision_at_3 vs. previous run */
    precision_at_3_delta?: number;
    /**
     * Task 9.3 — % of LLM-enriched runs where enrichment verdict matches the human label.
     * Only populated when evidence bundles with llm_traces are present.
     */
    llm_enrichment_agreement?: number;
    /** Task 9.2 — whether all evidence bundles had llm_traces + retrieved_chunks arrays */
    llm_trace_assertions_passed?: boolean;
}
export declare function getEvalRuns(): readonly EvalRun[];
export declare function getLatestEvalRun(): EvalRun | undefined;
export declare function _clearEvalRuns(): void;
export interface EvalRunnerOptions {
    /** Subset of gold-set entry IDs to evaluate (default: all) */
    entryIds?: string[];
    /** Semantic version / SHA of the analysis engine */
    schemaVersion?: string;
    /** Previous eval run to compare against for regression detection */
    previousRun?: EvalRun;
}
export declare function runEvaluation(opts?: EvalRunnerOptions): Promise<EvalRun>;
