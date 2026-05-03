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
import type { SubagentScope, ResearchSubagentConfig } from "./types.js";
/**
 * Build a scoped knowledge configuration for the operational subagent.
 * All sources are constrained to `projectKey`.
 */
export declare function buildOperationalScope(projectKey: string, confluenceSpace?: string, extraRepos?: string[]): SubagentScope;
/**
 * Assertion: the scoped operational subagent MUST NOT be able to access
 * `otherProjectKey`.
 *
 * Returns true if the scope correctly excludes the other project.
 * Throws if the scope would grant access (test-callable boundary check).
 */
export declare function assertScopeExcludes(scope: SubagentScope, otherProjectKey: string): boolean;
/**
 * Create a research subagent configuration.
 * Throws if the user has exceeded their daily rate limit (30/day).
 * The returned `session_id` is always fresh (never reused from the
 * operational subagent's session).
 */
export declare function createResearchSubagentConfig(projectKey: string, issueKey: string, userId: string): ResearchSubagentConfig;
/**
 * Assertion: the research subagent config must have a DIFFERENT session_id
 * to the operational subagent's session.
 */
export declare function assertSubagentIsolation(operationalSessionId: string, researchConfig: ResearchSubagentConfig): void;
/** Reset rate-limit store — for testing only */
export declare function _resetRateLimits(): void;
/** Peek at today's request count for a user — for testing only */
export declare function _getRequestsToday(userId: string): number;
