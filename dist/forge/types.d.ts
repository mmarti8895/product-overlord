/**
 * Forge Stage-3 Types
 *
 * Shared envelope types used by all Forge-callable endpoints and the
 * Rovo agent action layer.  All response sizes are guarded to ≤ 4.5 MB;
 * payloads that exceed that limit are replaced with a summary envelope
 * that carries a `deep_link` to the full package outside Forge.
 */
import type { ReadinessStatus, MissingItem, ActionPackage, ReviewerVerdict } from "../types/index.js";
export interface ForgeEnvelope {
    /** UUID from the evidence store run */
    run_id: string;
    /** ≤ 500-char human-readable summary */
    summary: string;
    /** Readiness verdict */
    verdict: ReadinessStatus;
    /** Normalised readiness score 0–100 */
    score: number;
    /** Top-3 missing items (severity-ranked) */
    top_missing_items: Pick<MissingItem, "dimension" | "severity">[];
    /** URL to the full action package in the external planning tool */
    deep_link: string;
    /** Human approval gate URL — caller must POST here to write the Jira comment */
    confirm_post_url: string;
    /** Present when the response was truncated due to payload-size guard */
    next_cursor?: string;
    /** Present when the orchestrator did not respond in time */
    status?: "ok" | "timeout" | "truncated";
}
export interface IngestIssueRequest {
    issue_key: string;
    /** Optional: base URL override for confirm_post_url construction */
    base_url?: string;
}
export interface IngestIssueResponse extends ForgeEnvelope {
    /** Full action package — present only when payload ≤ 4.5 MB */
    action_package?: ActionPackage;
    reviewer_verdict?: ReviewerVerdict;
}
export interface IngestBoardRequest {
    board_id: number;
    /** Opaque cursor string from a previous page's `next_cursor` field */
    cursor?: string;
    /** How many issues per page (default 25, max 50) */
    page_size?: number;
    base_url?: string;
}
export interface BoardIssueEnvelope extends ForgeEnvelope {
    /** Position in the board sweep so "load more" UI can resume */
    issue_index: number;
}
export interface IngestBoardResponse {
    run_id: string;
    board_id: number;
    issues: BoardIssueEnvelope[];
    /** Present when more pages are available */
    next_cursor?: string;
    total_issues_on_page: number;
    status: "ok" | "timeout" | "truncated";
}
export interface GetPlanResponse {
    run_id: string;
    found: boolean;
    action_package?: ActionPackage;
    reviewer_verdict?: ReviewerVerdict;
    /** Forge envelope of the top-level summary */
    envelope?: ForgeEnvelope;
    error?: string;
}
export interface ConfirmPostRequest {
    /** CSRF token generated at draft-emit time; must match stored token */
    csrf_token: string;
    /** Approver's Jira account ID */
    approver_account_id: string;
}
export interface ConfirmPostResponse {
    run_id: string;
    /** "posted" when Jira comment written; "discarded" when user cancelled */
    outcome: "posted" | "discarded" | "error";
    jira_comment_id?: string;
    error?: string;
}
export interface AnalyseTicketAction {
    issue_key: string;
    /** Triggers research subagent (opt-in, rate-limited 30/day) */
    deep_analysis?: boolean;
    base_url?: string;
}
export interface BoardSweepAction {
    board_id: number;
    cursor?: string;
    page_size?: number;
    base_url?: string;
}
export interface ConfirmCommentAction {
    run_id: string;
    csrf_token: string;
    approver_account_id: string;
}
export type A2AEventType = "assignment" | "mention";
export interface A2AEvent {
    event_type: A2AEventType;
    issue_key: string;
    triggered_by_account_id: string;
    timestamp: string;
}
export interface A2AResponse {
    accepted: boolean;
    run_id?: string;
    draft_summary?: string;
    confirm_post_url?: string;
    error?: string;
    /** Present when feature flag is off */
    feature_disabled?: boolean;
}
export interface SubagentScope {
    project_key: string;
    confluence_space?: string;
    repo_resources: string[];
    policy_resources: string[];
}
export interface ResearchSubagentConfig {
    project_key: string;
    issue_key: string;
    /** Isolated MCP session ID — must not share state with operational subagent */
    session_id: string;
    /** Rate-limit: 30 per user per day */
    requests_today: number;
    /** Timeout: 15 minutes */
    timeout_ms: number;
}
export declare const RESEARCH_SUBAGENT_RATE_LIMIT = 30;
export declare const RESEARCH_SUBAGENT_TIMEOUT_MS: number;
export interface ForgeActionMetric {
    action: string;
    latency_ms: number;
    status: "ok" | "timeout" | "error" | "truncated";
    payload_bytes: number;
    truncated: boolean;
}
export interface DeepLinkClickEvent {
    run_id: string;
    issue_key: string;
    source: "forge_summary" | "board_sweep";
    timestamp: string;
}
