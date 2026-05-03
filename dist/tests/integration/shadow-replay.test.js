/**
 * Integration tests — Shadow-Mode Replay (Task 3.4)
 *
 * 3.4  Confirm:
 *   a) zero Jira writes occur during a shadow replay
 *   b) diff report format is correct
 *   c) per-ticket records are persisted in the audit store
 *   d) evidence bundles are accessible for drill-down
 */
import { describe, it, expect, beforeEach } from "vitest";
import { runShadowReplay, getAuditRecords, getReplayReports, exportAuditLog, drillDownEvidence, _clearAuditStore, } from "../../eval/shadow-replay.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeIssue(key, type = "story", hasCriteria = true) {
    return {
        key,
        fields: {
            summary: `Summary for ${key}`,
            description: "Some description",
            issuetype: { name: type },
            status: { name: "To Do" },
            priority: { name: "Medium" },
            labels: [],
            reporter: { displayName: "integration-test" },
            assignee: null,
            comment: { comments: [] },
            issuelinks: [],
            ...(hasCriteria ? { "Acceptance Criteria": "Given X when Y then Z" } : {}),
        },
    };
}
beforeEach(() => {
    _clearAuditStore();
});
// ---------------------------------------------------------------------------
// 3.4a — zero Jira writes
// ---------------------------------------------------------------------------
describe("3.4a – zero Jira writes", () => {
    it("shadow replay sets zero_jira_writes: true on the diff report", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [
                { raw_issue: makeIssue("SHD-1"), human_verdict: "ready" },
                { raw_issue: makeIssue("SHD-2", "bug"), human_verdict: "blocked" },
            ],
        });
        expect(report.zero_jira_writes).toBe(true);
    });
    it("diff report is present in the report store after run", async () => {
        await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [{ raw_issue: makeIssue("SHD-3") }],
        });
        const reports = getReplayReports();
        expect(reports).toHaveLength(1);
        expect(reports[0].zero_jira_writes).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// 3.4b — diff report format
// ---------------------------------------------------------------------------
describe("3.4b – diff report format", () => {
    it("report has all required top-level fields", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-15",
            tickets: [
                { raw_issue: makeIssue("SHD-10"), human_verdict: "ready" },
                { raw_issue: makeIssue("SHD-11", "story", false) }, // no human verdict
            ],
        });
        expect(report).toMatchObject({
            replay_run_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-15",
            total_replayed: 2,
            zero_jira_writes: true,
        });
        expect(typeof report.matched).toBe("number");
        expect(typeof report.mismatched).toBe("number");
        expect(typeof report.unscored).toBe("number");
        expect(typeof report.classification_agreement).toBe("number");
        expect(report.classification_agreement).toBeGreaterThanOrEqual(0);
        expect(report.classification_agreement).toBeLessThanOrEqual(1);
    });
    it("unscored count equals tickets without human_verdict", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [
                { raw_issue: makeIssue("SHD-20"), human_verdict: "ready" },
                { raw_issue: makeIssue("SHD-21") }, // no human verdict
                { raw_issue: makeIssue("SHD-22") }, // no human verdict
                { raw_issue: makeIssue("SHD-23"), human_verdict: "blocked" },
            ],
        });
        expect(report.total_replayed).toBe(4);
        expect(report.unscored).toBe(2);
        expect(report.matched + report.mismatched).toBe(2); // scored subset
    });
    it("per_ticket array mirrors input tickets", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [
                { raw_issue: makeIssue("SHD-30"), human_verdict: "ready" },
                { raw_issue: makeIssue("SHD-31"), human_verdict: "needs_clarification" },
            ],
        });
        expect(report.per_ticket).toHaveLength(2);
        expect(report.per_ticket[0].issue_key).toBe("SHD-30");
        expect(report.per_ticket[1].issue_key).toBe("SHD-31");
        report.per_ticket.forEach((t) => {
            expect(["ready", "needs_clarification", "blocked"]).toContain(t.system_verdict);
            expect(t.match).toBeDefined();
        });
    });
    it("classification_agreement is 1.0 when all unscored", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [
                { raw_issue: makeIssue("SHD-40") },
                { raw_issue: makeIssue("SHD-41") },
            ],
        });
        expect(report.unscored).toBe(2);
        expect(report.classification_agreement).toBe(1); // vacuously 1 when no scored entries
    });
});
// ---------------------------------------------------------------------------
// 3.4c — per-ticket records in audit store
// ---------------------------------------------------------------------------
describe("3.4c – audit store population", () => {
    it("creates one audit record per ticket", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [
                { raw_issue: makeIssue("AUD-1") },
                { raw_issue: makeIssue("AUD-2") },
                { raw_issue: makeIssue("AUD-3") },
            ],
        });
        const records = getAuditRecords().filter((r) => r.replay_run_id === report.replay_run_id);
        expect(records).toHaveLength(3);
    });
    it("audit record has all required fields", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [{ raw_issue: makeIssue("AUD-10"), human_verdict: "needs_clarification" }],
        });
        const record = getAuditRecords().find((r) => r.replay_run_id === report.replay_run_id);
        expect(record).toMatchObject({
            record_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            replay_run_id: report.replay_run_id,
            issue_key: "AUD-10",
            analysed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
            verdict: expect.stringMatching(/^(ready|needs_clarification|blocked)$/),
            human_triage_verdict: "needs_clarification",
            verdict_match: expect.any(Boolean),
            adapter_traces: expect.any(Array),
            agent_outputs: expect.objectContaining({
                score: expect.any(Number),
                missing_item_count: expect.any(Number),
                question_count: expect.any(Number),
                top_questions: expect.any(Array),
            }),
            correction_log: [],
            promotion_status: "none",
        });
    });
    it("multiple sequential replay runs produce separate record sets", async () => {
        const r1 = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-15",
            tickets: [{ raw_issue: makeIssue("SEQ-1") }],
        });
        const r2 = await runShadowReplay({
            date_range_start: "2026-04-16",
            date_range_end: "2026-04-30",
            tickets: [{ raw_issue: makeIssue("SEQ-2") }, { raw_issue: makeIssue("SEQ-3") }],
        });
        const rec1 = getAuditRecords().filter((r) => r.replay_run_id === r1.replay_run_id);
        const rec2 = getAuditRecords().filter((r) => r.replay_run_id === r2.replay_run_id);
        expect(rec1).toHaveLength(1);
        expect(rec2).toHaveLength(2);
    });
});
// ---------------------------------------------------------------------------
// 3.4d — evidence drill-down
// ---------------------------------------------------------------------------
describe("3.4d – evidence drill-down", () => {
    it("drillDownEvidence returns an evidence bundle for a valid audit record", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [{ raw_issue: makeIssue("DRD-1") }],
        });
        const record = getAuditRecords().find((r) => r.replay_run_id === report.replay_run_id);
        const bundle = drillDownEvidence(record.record_id);
        expect(bundle).toBeDefined();
        expect(bundle.run_id).toBe(record.evidence_run_id);
    });
    it("drillDownEvidence returns undefined for unknown record_id", () => {
        expect(drillDownEvidence("no-such-record")).toBeUndefined();
    });
});
// ---------------------------------------------------------------------------
// 3.3 — structured log export
// ---------------------------------------------------------------------------
describe("3.3 – structured log export", () => {
    it("exportAuditLog produces one JSON line per audit record", async () => {
        const report = await runShadowReplay({
            date_range_start: "2026-04-01",
            date_range_end: "2026-04-30",
            tickets: [
                { raw_issue: makeIssue("LOG-1") },
                { raw_issue: makeIssue("LOG-2") },
            ],
        });
        const log = exportAuditLog(report.replay_run_id);
        const lines = log.split("\n").filter(Boolean);
        expect(lines).toHaveLength(2);
        lines.forEach((line) => {
            const obj = JSON.parse(line);
            expect(obj).toHaveProperty("record_id");
            expect(obj).toHaveProperty("issue_key");
            expect(obj).toHaveProperty("replay_run_id", report.replay_run_id);
        });
    });
    it("exportAuditLog returns empty string for unknown replay_run_id", () => {
        expect(exportAuditLog("no-such-run")).toBe("");
    });
});
