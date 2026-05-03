/**
 * Deep-Research Subagent (Tasks 5.1 – 5.4)
 *
 * 5.1  Isolated MCP session; all findings tagged `source: "deep-research"`.
 * 5.2  Rate limiter: 30 req/user/calendar day UTC; clear error on limit exceeded.
 * 5.3  15-minute timeout: cancel job, return `status: timeout` partial, log to
 *      evidence store.
 * 5.4  Tests in src/tests/integration/deep-research.test.ts
 */
import { evidenceStore } from "../evidence/store.js";
import { logger } from "../utils/logger.js";
import { createResearchSubagentConfig, assertSubagentIsolation, } from "./subagent.js";
import { RESEARCH_SUBAGENT_TIMEOUT_MS } from "./types.js";
/**
 * Run a deep-research analysis job with:
 *   - a fresh, isolated MCP session (5.1)
 *   - rate-limit enforcement (5.2)
 *   - 15-minute timeout (5.3)
 *   - evidence store logging on all exit paths
 */
export async function runDeepResearch(opts) {
    const start = Date.now();
    // ── 5.2  Rate limit check (throws on exceeded) ──────────────────────────
    let config;
    try {
        config = createResearchSubagentConfig(opts.projectKey, opts.issueKey, opts.userId);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("deep_research_rate_limited", {
            user: opts.userId,
            issue_key: opts.issueKey,
            message,
        });
        return {
            status: "rate_limited",
            elapsed_ms: Date.now() - start,
            session_id: "",
            message,
        };
    }
    // ── 5.1  Assert session isolation ───────────────────────────────────────
    assertSubagentIsolation(opts.operationalSessionId, config);
    const sessionId = config.session_id;
    const timeoutMs = opts.timeoutMs ?? RESEARCH_SUBAGENT_TIMEOUT_MS;
    logger.info("deep_research_start", {
        session_id: sessionId,
        issue_key: opts.issueKey,
        user: opts.userId,
        timeout_ms: timeoutMs,
    });
    // ── 5.3  Timeout wrapper ─────────────────────────────────────────────────
    let result;
    try {
        const jobPromise = opts.analysisJob(sessionId);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs));
        const jobResult = await Promise.race([jobPromise, timeoutPromise]);
        // Tag all findings with source: "deep-research"
        const taggedFindings = jobResult.findings.map((f) => ({
            ...f,
            source: "deep-research",
        }));
        result = {
            status: "ok",
            findings: taggedFindings,
            enriched_readiness: jobResult.enriched_readiness,
            elapsed_ms: Date.now() - start,
            session_id: sessionId,
        };
        logger.info("deep_research_complete", {
            session_id: sessionId,
            issue_key: opts.issueKey,
            finding_count: taggedFindings.length,
            elapsed_ms: result.elapsed_ms,
        });
    }
    catch (err) {
        const isTimeout = err instanceof Error && err.message === "TIMEOUT";
        const elapsed = Date.now() - start;
        if (isTimeout) {
            logger.warn("deep_research_timeout", {
                session_id: sessionId,
                issue_key: opts.issueKey,
                timeout_ms: timeoutMs,
                elapsed_ms: elapsed,
            });
            result = {
                status: "timeout",
                elapsed_ms: elapsed,
                session_id: sessionId,
                message: `Deep-research job timed out after ${timeoutMs}ms`,
                enriched_readiness: {}, // partial — whatever completed before cutoff
            };
        }
        else {
            logger.error("deep_research_error", {
                session_id: sessionId,
                issue_key: opts.issueKey,
                error: String(err),
            });
            result = {
                status: "error",
                elapsed_ms: elapsed,
                session_id: sessionId,
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }
    // ── Log to evidence store on all exit paths ────────────────────────────
    try {
        const evidenceRunId = evidenceStore.save({
            ticket_key: opts.issueKey,
            deep_research_session_id: sessionId,
            status: result.status,
            elapsed_ms: result.elapsed_ms,
            finding_count: result.findings?.length ?? 0,
            source: "deep-research",
        });
        result.evidence_run_id = evidenceRunId;
    }
    catch (storeErr) {
        logger.error("deep_research_evidence_store_error", { error: String(storeErr) });
    }
    return result;
}
