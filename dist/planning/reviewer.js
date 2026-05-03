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
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Rule helpers
// ---------------------------------------------------------------------------
const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
function checkRequiredFields(pkg) {
    const errors = [];
    if (!pkg.ticket_key)
        errors.push("missing field: ticket_key");
    if (!pkg.readiness_status)
        errors.push("missing field: readiness_status");
    if (!pkg.branch_name_suggestion)
        errors.push("missing field: branch_name_suggestion");
    if (!pkg.openspec_change_slug)
        errors.push("missing field: openspec_change_slug");
    return errors;
}
function checkPermissions(pkg, allowedComponents) {
    if (!allowedComponents)
        return [];
    const violations = pkg.candidate_components
        .filter((c) => !allowedComponents.has(c.name))
        .map((c) => `component '${c.name}' is not in caller's permission scope`);
    return violations;
}
function checkScoreThreshold(pkg, minScore) {
    if (pkg.readiness_score < minScore && !pkg.conflict) {
        return [
            `readiness_score ${pkg.readiness_score} is below minimum ${minScore} and no conflict explanation is provided`,
        ];
    }
    return [];
}
function checkBranchKey(pkg) {
    const key = pkg.ticket_key.toLowerCase();
    if (!pkg.branch_name_suggestion.includes(key)) {
        return [
            `branch_name_suggestion '${pkg.branch_name_suggestion}' does not contain work-item key '${key}'`,
        ];
    }
    return [];
}
function checkSlug(pkg) {
    const slug = pkg.openspec_change_slug;
    if (!slug || !SLUG_RE.test(slug)) {
        return [`openspec_change_slug '${slug}' is not a valid URL-safe slug`];
    }
    return [];
}
// ---------------------------------------------------------------------------
// Reviewer
// ---------------------------------------------------------------------------
export function reviewActionPackage(pkg, config = {}) {
    const minScore = config.minReadinessScore ?? 50;
    const reasons = [
        ...checkRequiredFields(pkg),
        ...checkPermissions(pkg, config.allowedComponents),
        ...checkScoreThreshold(pkg, minScore),
        ...checkBranchKey(pkg),
        ...checkSlug(pkg),
    ];
    const approved = reasons.length === 0;
    logger.info("reviewer_verdict", {
        ticket_key: pkg.ticket_key,
        approved,
        rejection_count: reasons.length,
    });
    return { approved, reasons };
}
