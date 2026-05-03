/**
 * Shadow-Mode Replay Pipeline (Tasks 3.1 – 3.3)
 *
 * 3.1  Accepts a date range, replays production tickets in read-only mode,
 *      emits a diff report vs. human triage labels (no Jira writes).
 * 3.2  Audit dashboard data model: run_id, verdict, adapter_traces,
 *      agent_outputs, correction_log, promotion_status, eval_run_id.
 * 3.3  Structured log export with per-run evidence drill-down.
 */
import type { ReadinessStatus, AdapterTrace } from "../types/index.js";
import type { RawIssue } from "../adapters/rovo-mcp.js";
/** One entry in the correction log — records a human override of system verdict */
export interface CorrectionLogEntry {
    timestamp: string;
    original_verdict: ReadinessStatus;
    corrected_verdict: ReadinessStatus;
    corrected_by: string;
    reason?: string;
}
/** Promotion status for a replay run (tied to reflection candidates) */
export type PromotionStatus = "none" | "pending_review" | "approved" | "rejected";
/**
 * 3.2  Audit record — one row per ticket analysed in a shadow-replay run.
 * Stored in-process; suitable for JSON export or dashboard rendering.
 */
export interface AuditRecord {
    /** UUID for this audit record */
    record_id: string;
    /** The shadow-replay run that produced this record */
    replay_run_id: string;
    /** Jira issue key */
    issue_key: string;
    /** ISO-8601 timestamp of the analysis */
    analysed_at: string;
    /** System verdict in shadow mode */
    verdict: ReadinessStatus;
    /** Human triage label (if provided for comparison) */
    human_triage_verdict?: ReadinessStatus;
    /** Whether system verdict matched human triage */
    verdict_match?: boolean;
    /** Adapter traces recorded during this analysis */
    adapter_traces: AdapterTrace[];
    /** Serialised agent outputs (questions, missing items, score) */
    agent_outputs: {
        score: number;
        missing_item_count: number;
        question_count: number;
        top_questions: string[];
    };
    /** Corrections applied by humans after the fact */
    correction_log: CorrectionLogEntry[];
    /** Promotion status of any reflection candidate derived from this record */
    promotion_status: PromotionStatus;
    /** ID of the eval run this record belongs to (if run via eval pipeline) */
    eval_run_id?: string;
    /** Evidence bundle run_id for full drill-down */
    evidence_run_id?: string;
}
/** Summary diff report emitted at the end of a replay run */
export interface ReplayDiffReport {
    replay_run_id: string;
    date_range_start: string;
    date_range_end: string;
    total_replayed: number;
    /** Tickets where system verdict matched human triage */
    matched: number;
    /** Tickets where system verdict differed from human triage */
    mismatched: number;
    /** Tickets with no human triage label (unscored) */
    unscored: number;
    /** Classification agreement (0–1) over scored subset */
    classification_agreement: number;
    /** Per-ticket breakdown */
    per_ticket: Array<{
        issue_key: string;
        system_verdict: ReadinessStatus;
        human_verdict?: ReadinessStatus;
        match?: boolean;
    }>;
    /** Zero Jira writes occurred — always true for valid shadow replays */
    zero_jira_writes: true;
}
export interface ReplayTicketInput {
    /** RawIssue payload (from Jira Agile REST or fixture) */
    raw_issue: RawIssue;
    /** Human-applied triage label (optional; used for diff) */
    human_verdict?: ReadinessStatus;
    /** ISO-8601 date when the ticket was triaged */
    triaged_at?: string;
}
export interface ShadowReplayOptions {
    /** ISO-8601 date string (inclusive start) */
    date_range_start: string;
    /** ISO-8601 date string (inclusive end) */
    date_range_end: string;
    /** Tickets to replay */
    tickets: ReplayTicketInput[];
    /** Optional eval run ID to associate with this replay */
    eval_run_id?: string;
}
export declare function getAuditRecords(): readonly AuditRecord[];
export declare function getReplayReports(): readonly ReplayDiffReport[];
export declare function getAuditRecordsByReplayRun(replayRunId: string): AuditRecord[];
/** @internal */
export declare function _clearAuditStore(): void;
/**
 * Export all audit records for a given replay run as a newline-delimited
 * JSON string.  Each line is one JSON object (suitable for log ingestion).
 */
export declare function exportAuditLog(replayRunId: string): string;
/**
 * Drill-down: return the full evidence bundle for an audit record.
 */
export declare function drillDownEvidence(recordId: string): unknown | undefined;
/**
 * Run shadow-mode replay over a set of historical tickets.
 *
 * INVARIANT: this function NEVER writes to Jira.  It calls only
 * normaliseTicket → scoreTicket → applyQuestions (the same shadow path
 * used by the eval runner).
 */
export declare function runShadowReplay(opts: ShadowReplayOptions): Promise<ReplayDiffReport>;
