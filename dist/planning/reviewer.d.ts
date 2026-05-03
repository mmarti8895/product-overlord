/**
 * Reviewer Agent
 *
 * Validates an ActionPackage before emission. Enforces five rules:
 *   1. Required fields present (ticket_key, readiness_status, branch_name_suggestion, openspec_change_slug)
 *   2. Permission scope — no references to components the caller cannot access (placeholder)
 *   3. Score threshold — readiness_score ≥ minScore OR an explanation is provided
 *   4. Branch name contains work-item key
 *   5. OpenSpec slug is non-empty and URL-safe
 */
import type { ActionPackage, ReviewerVerdict } from "../types/index.js";
export interface ReviewerConfig {
    /** Minimum readiness score to approve without conflict override. Default: 50 */
    minReadinessScore?: number;
    /**
     * Set of component names the caller is authorised to see.
     * If undefined, permission check is skipped (open policy).
     */
    allowedComponents?: Set<string>;
}
export declare function reviewActionPackage(pkg: ActionPackage, config?: ReviewerConfig): ReviewerVerdict;
