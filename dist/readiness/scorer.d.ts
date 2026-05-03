/**
 * Readiness Scoring Engine
 *
 * Deterministic, code-based scoring (no LLM logic).
 *
 * Algorithm:
 *   1. For each dimension in the profile, check whether the ticket's relevant
 *      fields have non-empty values.
 *   2. Dimensions that pass contribute their weight to the raw score.
 *   3. Raw score is scaled to 0–100.
 *   4. Dependency check: any dependency with status "Open" | "To Do" is a
 *      hard blocker → verdict forced to "blocked".
 *   5. Confidence is driven by data completeness (ratio of fields populated
 *      across all dimensions).
 *   6. Verdict:
 *       score ≥ 80 AND no blockers → "ready"
 *       any high-severity missing item OR blocker → "blocked" / "needs_clarification"
 *       otherwise → "needs_clarification"
 */
import type { CanonicalTicket, ReadinessResult } from "../types/index.js";
import type { ReadinessProfile } from "./profile.js";
export interface ScorerOptions {
    /** Override the ready score threshold (default 80) */
    readyThreshold?: number;
}
export interface ScorerInput {
    ticket: CanonicalTicket;
    profile: ReadinessProfile;
    profileSource: "project" | "default";
    options?: ScorerOptions;
}
export interface ScorerOutput extends ReadinessResult {
}
export declare function scoreTicket(input: ScorerInput): ScorerOutput;
