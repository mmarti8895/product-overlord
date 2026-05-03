/**
 * Shadow-Mode Replay Pipeline (Tasks 3.1 – 3.3)
 *
 * 3.1  Accepts a date range, replays production tickets in read-only mode,
 *      emits a diff report vs. human triage labels (no Jira writes).
 * 3.2  Audit dashboard data model: run_id, verdict, adapter_traces,
 *      agent_outputs, correction_log, promotion_status, eval_run_id.
 * 3.3  Structured log export with per-run evidence drill-down.
 */
import { randomUUID } from "crypto";
import { normaliseTicket } from "../normaliser/normalise.js";
import { scoreTicket } from "../readiness/scorer.js";
import { applyQuestions } from "../readiness/clarification.js";
import { ProfileRegistry, DEFAULT_STORY_PROFILE, DEFAULT_BUG_PROFILE, DEFAULT_TASK_PROFILE, } from "../readiness/profile.js";
import { evidenceStore } from "../evidence/store.js";
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// In-process stores (3.2 + 3.3)
// ---------------------------------------------------------------------------
const auditRecordStore = [];
const replayReportStore = [];
export function getAuditRecords() {
    return auditRecordStore;
}
export function getReplayReports() {
    return replayReportStore;
}
export function getAuditRecordsByReplayRun(replayRunId) {
    return auditRecordStore.filter((r) => r.replay_run_id === replayRunId);
}
/** @internal */
export function _clearAuditStore() {
    auditRecordStore.length = 0;
    replayReportStore.length = 0;
}
// ---------------------------------------------------------------------------
// Profile registry
// ---------------------------------------------------------------------------
const registry = new ProfileRegistry([
    DEFAULT_STORY_PROFILE,
    DEFAULT_BUG_PROFILE,
    DEFAULT_TASK_PROFILE,
]);
// ---------------------------------------------------------------------------
// 3.3  Structured log export
// ---------------------------------------------------------------------------
/**
 * Export all audit records for a given replay run as a newline-delimited
 * JSON string.  Each line is one JSON object (suitable for log ingestion).
 */
export function exportAuditLog(replayRunId) {
    const records = getAuditRecordsByReplayRun(replayRunId);
    return records.map((r) => JSON.stringify(r)).join("\n");
}
/**
 * Drill-down: return the full evidence bundle for an audit record.
 */
export function drillDownEvidence(recordId) {
    const record = auditRecordStore.find((r) => r.record_id === recordId);
    if (!record?.evidence_run_id)
        return undefined;
    return evidenceStore.get(record.evidence_run_id);
}
// ---------------------------------------------------------------------------
// 3.1  Shadow-mode replay pipeline — read-only, no Jira writes
// ---------------------------------------------------------------------------
/**
 * Run shadow-mode replay over a set of historical tickets.
 *
 * INVARIANT: this function NEVER writes to Jira.  It calls only
 * normaliseTicket → scoreTicket → applyQuestions (the same shadow path
 * used by the eval runner).
 */
export async function runShadowReplay(opts) {
    const replayRunId = randomUUID();
    logger.info("shadow_replay_start", {
        replay_run_id: replayRunId,
        total: opts.tickets.length,
        date_range: `${opts.date_range_start} → ${opts.date_range_end}`,
    });
    const perTicket = [];
    for (const item of opts.tickets) {
        const recordId = randomUUID();
        const analysedAt = new Date().toISOString();
        try {
            const canonical = normaliseTicket(item.raw_issue);
            const { profile, source } = registry.resolve(canonical.ticket_key.split("-")[0] ?? "", canonical.ticket_type);
            const scored = scoreTicket({ ticket: canonical, profile, profileSource: source });
            const result = applyQuestions(scored, profile);
            const systemVerdict = result.readiness_status;
            const humanVerdict = item.human_verdict;
            const match = humanVerdict !== undefined ? systemVerdict === humanVerdict : undefined;
            // Persist to evidence store for drill-down (read-only analysis path)
            const evidenceBundle = evidenceStore.persist({
                trigger: `shadow_replay:${replayRunId}`,
                adapter_traces: [],
                canonical_ticket: canonical,
                scorer_input: {
                    profile_id: profile.id,
                    profile_source: source,
                },
                scorer_output: result,
                verdict: systemVerdict,
                comment_draft_id: null,
            });
            const record = {
                record_id: recordId,
                replay_run_id: replayRunId,
                issue_key: item.raw_issue.key,
                analysed_at: analysedAt,
                verdict: systemVerdict,
                human_triage_verdict: humanVerdict,
                verdict_match: match,
                adapter_traces: [],
                agent_outputs: {
                    score: result.readiness_score,
                    missing_item_count: result.missing_items.length,
                    question_count: (result.questions_for_pm.length + result.questions_for_engineer.length + result.questions_for_qa.length),
                    top_questions: [...result.questions_for_pm, ...result.questions_for_engineer, ...result.questions_for_qa].slice(0, 3),
                },
                correction_log: [],
                promotion_status: "none",
                eval_run_id: opts.eval_run_id,
                evidence_run_id: evidenceBundle.run_id,
            };
            auditRecordStore.push(record);
            perTicket.push({
                issue_key: item.raw_issue.key,
                system_verdict: systemVerdict,
                human_verdict: humanVerdict,
                match,
            });
        }
        catch (err) {
            logger.error("shadow_replay_entry_error", {
                issue_key: item.raw_issue.key,
                error: String(err),
            });
            // Still record a failure entry
            const record = {
                record_id: recordId,
                replay_run_id: replayRunId,
                issue_key: item.raw_issue.key,
                analysed_at: analysedAt,
                verdict: "blocked",
                human_triage_verdict: item.human_verdict,
                verdict_match: false,
                adapter_traces: [],
                agent_outputs: { score: 0, missing_item_count: 0, question_count: 0, top_questions: [] },
                correction_log: [],
                promotion_status: "none",
                eval_run_id: opts.eval_run_id,
            };
            auditRecordStore.push(record);
            perTicket.push({
                issue_key: item.raw_issue.key,
                system_verdict: "blocked",
                human_verdict: item.human_verdict,
                match: false,
            });
        }
    }
    // ── Build diff report ────────────────────────────────────────────────────
    const scored = perTicket.filter((t) => t.human_verdict !== undefined);
    const matched = scored.filter((t) => t.match === true).length;
    const mismatched = scored.filter((t) => t.match === false).length;
    const unscored = perTicket.length - scored.length;
    const classificationAgreement = scored.length > 0 ? matched / scored.length : 1;
    const report = {
        replay_run_id: replayRunId,
        date_range_start: opts.date_range_start,
        date_range_end: opts.date_range_end,
        total_replayed: opts.tickets.length,
        matched,
        mismatched,
        unscored,
        classification_agreement: classificationAgreement,
        per_ticket: perTicket,
        zero_jira_writes: true,
    };
    replayReportStore.push(report);
    logger.info("shadow_replay_complete", {
        replay_run_id: replayRunId,
        total_replayed: report.total_replayed,
        matched,
        mismatched,
        unscored,
        classification_agreement_pct: +(classificationAgreement * 100).toFixed(1),
        zero_jira_writes: true,
    });
    return report;
}
