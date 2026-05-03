/**
 * Subagent Scoping (Tasks 5.1 – 5.4)
 *
 * Defines how the Jira-facing operational subagent and the isolated
 * research subagent are scoped, and provides assertion helpers used in
 * tests to verify knowledge-boundary enforcement.
 *
 * Key invariants
 *   - The operational subagent is scoped to ONE project key, its Confluence
 *     space, and the repo/policy MCP resources for that project.
 *   - It has NO access to other projects' data.
 *   - The research subagent gets a fresh MCP session (different session_id),
 *     is rate-limited to 30 requests/user/day, and times out after 15 min.
 *   - The two subagents NEVER share session state.
 */
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
import { RESEARCH_SUBAGENT_RATE_LIMIT, RESEARCH_SUBAGENT_TIMEOUT_MS, } from "./types.js";
// ---------------------------------------------------------------------------
// Operational subagent factory
// ---------------------------------------------------------------------------
/**
 * Build a scoped knowledge configuration for the operational subagent.
 * All sources are constrained to `projectKey`.
 */
export function buildOperationalScope(projectKey, confluenceSpace, extraRepos = []) {
    const repoResources = extraRepos.length > 0
        ? extraRepos
        : [`repo://${projectKey.toLowerCase()}/*`];
    return {
        project_key: projectKey,
        confluence_space: confluenceSpace ?? projectKey,
        repo_resources: repoResources,
        policy_resources: [`policy://${projectKey}/*`],
    };
}
/**
 * Assertion: the scoped operational subagent MUST NOT be able to access
 * `otherProjectKey`.
 *
 * Returns true if the scope correctly excludes the other project.
 * Throws if the scope would grant access (test-callable boundary check).
 */
export function assertScopeExcludes(scope, otherProjectKey) {
    const key = otherProjectKey.toUpperCase();
    if (scope.project_key.toUpperCase() === key) {
        // Same project — not an exclusion scenario
        return true;
    }
    // Check repo resources
    const repoLeak = scope.repo_resources.some((r) => r.toLowerCase().includes(otherProjectKey.toLowerCase()));
    const policyLeak = scope.policy_resources.some((r) => r.toLowerCase().includes(otherProjectKey.toLowerCase()));
    const confluenceLeak = scope.confluence_space?.toUpperCase() === key;
    if (repoLeak || policyLeak || confluenceLeak) {
        throw new Error(`Scope violation: operational subagent for project ${scope.project_key} has access to project ${otherProjectKey}`);
    }
    return true;
}
// ---------------------------------------------------------------------------
// Research subagent factory + rate-limit store
// ---------------------------------------------------------------------------
/** In-process per-user request count (keyed by user_id:YYYY-MM-DD) */
const researchRateLimitStore = new Map();
function rateLimitKey(userId) {
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `${userId}:${day}`;
}
/**
 * Create a research subagent configuration.
 * Throws if the user has exceeded their daily rate limit (30/day).
 * The returned `session_id` is always fresh (never reused from the
 * operational subagent's session).
 */
export function createResearchSubagentConfig(projectKey, issueKey, userId) {
    const key = rateLimitKey(userId);
    const today = researchRateLimitStore.get(key) ?? 0;
    if (today >= RESEARCH_SUBAGENT_RATE_LIMIT) {
        throw new Error(`Research subagent rate limit exceeded for user ${userId} (${RESEARCH_SUBAGENT_RATE_LIMIT}/day)`);
    }
    researchRateLimitStore.set(key, today + 1);
    logger.info("research_subagent_session_created", {
        user: userId,
        project_key: projectKey,
        issue_key: issueKey,
        requests_today: today + 1,
    });
    return {
        project_key: projectKey,
        issue_key: issueKey,
        session_id: randomUUID(), // isolated — never shared with operational subagent
        requests_today: today + 1,
        timeout_ms: RESEARCH_SUBAGENT_TIMEOUT_MS,
    };
}
/**
 * Assertion: the research subagent config must have a DIFFERENT session_id
 * to the operational subagent's session.
 */
export function assertSubagentIsolation(operationalSessionId, researchConfig) {
    if (operationalSessionId === researchConfig.session_id) {
        throw new Error("Subagent isolation violation: research subagent shares session_id with operational subagent");
    }
}
/** Reset rate-limit store — for testing only */
export function _resetRateLimits() {
    researchRateLimitStore.clear();
}
/** Peek at today's request count for a user — for testing only */
export function _getRequestsToday(userId) {
    return researchRateLimitStore.get(rateLimitKey(userId)) ?? 0;
}
