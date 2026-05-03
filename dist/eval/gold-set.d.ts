/**
 * Gold-Set Store (Tasks 1.1 – 1.3)
 *
 * Defines the versioned, human-labeled gold-set schema and ships the
 * initial 48-entry seed dataset covering every required distribution:
 *
 *   Distribution targets (task 1.2)
 *   - 1/3 ready (≥ 16 entries)
 *   - 1/3 needs_clarification (≥ 16 entries)
 *   - 1/3 blocked (≥ 16 entries)
 *
 *   Tag coverage (task 1.3)
 *   - ≥ 10 entries tagged "ac-alias"
 *   - ≥ 10 entries tagged "repo-ambiguity"
 *   - ≥ 6 entries tagged "permission-sensitive"
 *
 * Issue types covered: story, bug, task, regression, blocked, ambiguous
 */
import type { ReadinessStatus, IssueType } from "../types/index.js";
export type GoldSetTag = "ac-alias" | "repo-ambiguity" | "permission-sensitive" | "regression" | "ambiguous" | "blocked" | "cross-project" | "llm-enrichment" | "llm-kt-context";
export interface GoldSetEntry {
    /** Stable identifier, e.g. "gs-001" */
    id: string;
    /** Human-readable prompt that triggered the analysis */
    prompt: string;
    /** Issue type of the ticket */
    issue_type: IssueType;
    /** Broad bucket for stratified evaluation */
    bucket: "ready" | "needs_clarification" | "blocked";
    /** Expected readiness verdict */
    expected_readiness_status: ReadinessStatus;
    /** Dimensions expected to be flagged as missing */
    expected_missing_dimensions: string[];
    /** Top component names expected in the mapping (precision-at-3 denominator) */
    expected_top_components: string[];
    /** Sample question text fragments expected in the output */
    expected_questions: string[];
    /** Manual check items expected in the output */
    expected_manual_checks: string[];
    /** Free-form tags for filtered evaluation */
    tags: GoldSetTag[];
    /**
     * Fixture raw fields used to build a synthetic RawIssue for shadow mode.
     * Optional — if omitted the eval runner uses the prompt as a lookup key.
     */
    fixture?: {
        summary: string;
        description?: string;
        acceptance_criteria?: string;
        /** AC stored under a non-standard alias field name (for ac-alias tests) */
        ac_alias_field?: string;
        issue_type?: string;
        labels?: string[];
        priority?: string;
        dependencies?: {
            key: string;
            status: string;
        }[];
        repo_components?: string[];
    };
}
export declare const GOLD_SET: GoldSetEntry[];
export declare function getGoldSetByBucket(bucket: GoldSetEntry["bucket"]): GoldSetEntry[];
export declare function getGoldSetByTag(tag: GoldSetTag): GoldSetEntry[];
export declare function validateGoldSetDistribution(): {
    ready: number;
    needs_clarification: number;
    blocked: number;
    ac_alias: number;
    repo_ambiguity: number;
    permission_sensitive: number;
    valid: boolean;
    errors: string[];
};
