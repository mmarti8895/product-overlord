/**
 * Forge-Callable HTTP Endpoints
 *
 * Tasks 2.1 – 2.5
 *
 * Implements the four deterministic endpoints that the Forge Rovo agent
 * calls.  No Forge SDK is imported here — this is a pure TypeScript
 * request-handler module that can be unit-tested without a Forge runtime.
 *
 * Invariants
 *   - All responses are guarded to ≤ PAYLOAD_LIMIT_BYTES (4.5 MB).
 *   - If a payload would exceed the limit the response is truncated to a
 *     summary envelope; `status: "truncated"` and `next_cursor` are set.
 *   - Unauthenticated requests (no `authorization` header) receive 401.
 *   - Timeouts (orchestrator > ENDPOINT_TIMEOUT_MS) receive `status: "timeout"`.
 *   - Every action-package write requires an explicit human confirmation
 *     step (POST /forge/output/confirm/{run_id}) — the endpoint itself
 *     NEVER writes to Jira autonomously.
 */
import { randomUUID } from "crypto";
import { IngestionOrchestrator } from "../adapters/ingestion-orchestrator.js";
import { RovoMcpAdapter } from "../adapters/rovo-mcp.js";
import { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import { normaliseTicket } from "../normaliser/normalise.js";
import { runStage2Pipeline } from "../repo/stage2-orchestrator.js";
import { emitCommentDraft } from "../output/comment-draft.js";
import { evidenceStore } from "../evidence/store.js";
import { latencyTracker } from "../utils/latency.js";
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
/** Maximum allowed response payload before truncation kicks in */
export const PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024; // 4.5 MB
/** How long we wait for the orchestrator before returning a timeout envelope */
export const ENDPOINT_TIMEOUT_MS = 30_000; // 30 s
/** Default planning-tool base URL (overridden via base_url or env var) */
const DEFAULT_BASE_URL = process.env["PLANNING_TOOL_BASE_URL"] ?? "https://product-overlord.internal";
// ---------------------------------------------------------------------------
// In-process CSRF token store (run_id → token)
// ---------------------------------------------------------------------------
const csrfTokens = new Map();
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildDeepLink(base, runId) {
    return `${base}/runs/${runId}`;
}
function buildConfirmUrl(base, runId) {
    return `${base}/forge/output/confirm/${runId}`;
}
/** Serialise a value and return its UTF-8 byte length */
function byteLength(value) {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
}
/** Build a compact summary (≤ 500 chars) from an action package */
function buildSummary(pkg) {
    const operational = pkg.operational_risks?.slice(0, 3).join(", ") ?? "";
    const raw = `[${pkg.readiness_status.toUpperCase()}] score=${pkg.readiness_score} | ticket=${pkg.ticket_key}${operational ? ` | risks: ${operational}` : ""}${pkg.conflict ? " | ⚠ conflict" : ""}`;
    return raw.slice(0, 500);
}
/** Wrap an action package in a Forge envelope */
function toEnvelope(pkg, runId, base) {
    // Derive top missing items from manual_checks + operational_risks
    const topMissing = [
        ...pkg.manual_checks.slice(0, 3).map((c) => ({ dimension: c, severity: "medium" })),
        ...pkg.operational_risks.slice(0, 3).map((r) => ({ dimension: r, severity: "high" })),
    ].slice(0, 3);
    return {
        run_id: runId,
        summary: buildSummary(pkg),
        verdict: pkg.readiness_status,
        score: pkg.readiness_score,
        top_missing_items: topMissing,
        deep_link: buildDeepLink(base, runId),
        confirm_post_url: buildConfirmUrl(base, runId),
        status: "ok",
    };
}
/**
 * Payload-size guard (task 2.5):
 * if the candidate response is > PAYLOAD_LIMIT_BYTES, strip the full
 * action_package, set status:"truncated", and add a next_cursor so
 * the Forge UI can fetch the rest via deep_link.
 */
function applySizeGuard(response, runId) {
    if (byteLength(response) <= PAYLOAD_LIMIT_BYTES)
        return response;
    const truncated = { ...response };
    delete truncated.action_package;
    truncated.status = "truncated";
    truncated.next_cursor = runId; // opaque cursor = run_id
    logger.warn("forge_payload_size_guard_triggered", {
        run_id: runId,
        original_bytes: byteLength(response),
    });
    return truncated;
}
/** Race a promise against a timeout; returns null on timeout */
async function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
}
// ---------------------------------------------------------------------------
// Shared orchestrator singleton (can be overridden in tests)
// ---------------------------------------------------------------------------
let _orchestrator = null;
export function getOrchestrator() {
    if (!_orchestrator) {
        const baseUrl = process.env["JIRA_BASE_URL"] ?? "https://atlassian.example.com";
        const accessToken = process.env["JIRA_ACCESS_TOKEN"] ?? "";
        const cloudId = process.env["JIRA_CLOUD_ID"] ?? "cloud-default";
        _orchestrator = new IngestionOrchestrator(new RovoMcpAdapter({ baseUrl: `${baseUrl}/mcp`, accessToken, cloudId }), new JiraAgileRestAdapter({ baseUrl, accessToken }));
    }
    return _orchestrator;
}
/** Inject a mock orchestrator in tests */
export function setOrchestrator(o) {
    _orchestrator = o;
}
function unauthorized() {
    return { status: 401, body: { error: "Unauthorized — Forge token required" } };
}
function isAuthorized(req) {
    const auth = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
    return auth.length > 0;
}
// ---------------------------------------------------------------------------
// 2.1  POST /forge/ingest/issue
// ---------------------------------------------------------------------------
export async function handleIngestIssue(req) {
    if (!isAuthorized(req))
        return unauthorized();
    const body = req.body;
    const issueKey = body?.issue_key?.trim();
    if (!issueKey) {
        return {
            status: 400,
            body: { run_id: "", summary: "issue_key is required", verdict: "blocked", score: 0, top_missing_items: [], deep_link: "", confirm_post_url: "" },
        };
    }
    const base = body?.base_url ?? DEFAULT_BASE_URL;
    const start = Date.now();
    const result = await withTimeout((async () => {
        const orchestrator = getOrchestrator();
        const { issues } = await orchestrator.ingestIssue(issueKey);
        const canonical = normaliseTicket(issues[0]);
        const stage2 = await runStage2Pipeline({ ticket: canonical, componentIndex: null });
        const { actionPackage, reviewerVerdict, evidenceBundleId } = stage2;
        if (!actionPackage) {
            const envelope = {
                run_id: evidenceBundleId,
                summary: "Analysis failed — no action package produced",
                verdict: "blocked",
                score: 0,
                top_missing_items: [],
                deep_link: buildDeepLink(base, evidenceBundleId),
                confirm_post_url: buildConfirmUrl(base, evidenceBundleId),
                status: "ok",
            };
            return { ...envelope };
        }
        // Issue and store CSRF token
        const csrfToken = randomUUID();
        csrfTokens.set(evidenceBundleId, csrfToken);
        const envelope = toEnvelope(actionPackage, evidenceBundleId, base);
        const response = {
            ...envelope,
            action_package: actionPackage,
            reviewer_verdict: reviewerVerdict ?? undefined,
        };
        return applySizeGuard(response, evidenceBundleId);
    })(), ENDPOINT_TIMEOUT_MS);
    latencyTracker.record("forge/ingest/issue", Date.now() - start);
    if (!result) {
        const runId = randomUUID();
        logger.warn("forge_ingest_issue_timeout", { issue_key: issueKey });
        const envelope = {
            run_id: runId,
            summary: "Orchestrator timed out — retry via deep_link",
            verdict: "blocked",
            score: 0,
            top_missing_items: [],
            deep_link: buildDeepLink(base, runId),
            confirm_post_url: buildConfirmUrl(base, runId),
            status: "timeout",
        };
        return { status: 200, body: envelope };
    }
    return { status: 200, body: result };
}
// ---------------------------------------------------------------------------
// 2.2  GET /forge/ingest/board/{id}
// ---------------------------------------------------------------------------
export async function handleIngestBoard(req) {
    if (!isAuthorized(req))
        return unauthorized();
    const boardId = Number(req.params?.["id"] ?? req.query?.["id"] ?? "0");
    if (!boardId) {
        return {
            status: 400,
            body: { run_id: "", board_id: 0, issues: [], total_issues_on_page: 0, status: "ok" },
        };
    }
    const base = req.query?.["base_url"] ?? DEFAULT_BASE_URL;
    const pageSize = Math.min(Number(req.query?.["page_size"] ?? "25"), 50);
    const cursor = req.query?.["cursor"];
    const start = Date.now();
    const result = await withTimeout((async () => {
        const orchestrator = getOrchestrator();
        const { issues: rawIssues } = await orchestrator.ingestBoard(boardId);
        // Cursor: treat as an offset index into the raw issues array
        const offset = cursor ? parseInt(cursor, 10) : 0;
        const page = rawIssues.slice(offset, offset + pageSize);
        const hasMore = offset + pageSize < rawIssues.length;
        const nextCursor = hasMore ? String(offset + pageSize) : undefined;
        const envelopes = [];
        for (let i = 0; i < page.length; i++) {
            const raw = page[i];
            const canonical = normaliseTicket(raw);
            const stage2 = await runStage2Pipeline({ ticket: canonical, componentIndex: null });
            const { actionPackage, evidenceBundleId } = stage2;
            if (!actionPackage) {
                envelopes.push({
                    run_id: evidenceBundleId,
                    summary: `Analysis failed for ${canonical.ticket_key}`,
                    verdict: "blocked",
                    score: 0,
                    top_missing_items: [],
                    deep_link: buildDeepLink(base, evidenceBundleId),
                    confirm_post_url: buildConfirmUrl(base, evidenceBundleId),
                    status: "ok",
                    issue_index: offset + i,
                });
                continue;
            }
            const csrfToken = randomUUID();
            csrfTokens.set(evidenceBundleId, csrfToken);
            const env = toEnvelope(actionPackage, evidenceBundleId, base);
            envelopes.push({ ...env, issue_index: offset + i });
        }
        const runId = randomUUID();
        const response = {
            run_id: runId,
            board_id: boardId,
            issues: envelopes,
            next_cursor: nextCursor,
            total_issues_on_page: envelopes.length,
            status: "ok",
        };
        // Page-level size guard
        if (byteLength(response) > PAYLOAD_LIMIT_BYTES) {
            logger.warn("forge_board_payload_truncated", { board_id: boardId, run_id: runId });
            return { ...response, status: "truncated", next_cursor: nextCursor ?? String(offset + pageSize) };
        }
        return response;
    })(), ENDPOINT_TIMEOUT_MS);
    latencyTracker.record("forge/ingest/board", Date.now() - start);
    if (!result) {
        logger.warn("forge_ingest_board_timeout", { board_id: boardId });
        return {
            status: 200,
            body: {
                run_id: randomUUID(),
                board_id: boardId,
                issues: [],
                total_issues_on_page: 0,
                status: "timeout",
            },
        };
    }
    return { status: 200, body: result };
}
// ---------------------------------------------------------------------------
// 2.3  GET /forge/plan/{run_id}
// ---------------------------------------------------------------------------
export async function handleGetPlan(req) {
    if (!isAuthorized(req))
        return unauthorized();
    const runId = req.params?.["run_id"] ?? req.query?.["run_id"] ?? "";
    if (!runId) {
        return { status: 400, body: { run_id: "", found: false, error: "run_id is required" } };
    }
    const base = req.query?.["base_url"] ?? DEFAULT_BASE_URL;
    const bundle = evidenceStore.get(runId);
    if (!bundle) {
        return { status: 404, body: { run_id: runId, found: false, error: "run not found or expired" } };
    }
    // The evidence bundle may carry a stage-2 action package under metadata
    const meta = bundle.metadata;
    const actionPackage = meta?.action_package ?? undefined;
    const envelope = actionPackage
        ? toEnvelope(actionPackage, runId, base)
        : undefined;
    const response = {
        run_id: runId,
        found: true,
        action_package: actionPackage,
        envelope,
    };
    return { status: 200, body: applySizeGuard(response, runId) };
}
// ---------------------------------------------------------------------------
// 2.4  POST /forge/output/confirm/{run_id}
// ---------------------------------------------------------------------------
export async function handleConfirmPost(req) {
    if (!isAuthorized(req))
        return unauthorized();
    const runId = req.params?.["run_id"] ?? "";
    if (!runId) {
        return { status: 400, body: { run_id: "", outcome: "error", error: "run_id is required" } };
    }
    const body = req.body;
    const csrfToken = body?.csrf_token ?? "";
    const approverId = body?.approver_account_id ?? "";
    if (!csrfToken || !approverId) {
        return {
            status: 400,
            body: { run_id: runId, outcome: "error", error: "csrf_token and approver_account_id are required" },
        };
    }
    // CSRF validation
    const storedToken = csrfTokens.get(runId);
    if (!storedToken || storedToken !== csrfToken) {
        logger.warn("forge_confirm_post_csrf_mismatch", { run_id: runId });
        return { status: 403, body: { run_id: runId, outcome: "error", error: "Invalid or expired CSRF token" } };
    }
    const bundle = evidenceStore.get(runId);
    if (!bundle) {
        return { status: 404, body: { run_id: runId, outcome: "error", error: "run not found or expired" } };
    }
    // Generate a comment draft if not already stored in the bundle
    const readinessResult = bundle.scorer_output;
    if (!readinessResult) {
        return { status: 422, body: { run_id: runId, outcome: "error", error: "No readiness result found for this run — cannot draft comment" } };
    }
    const draft = emitCommentDraft(readinessResult, runId);
    // In production this would post to Jira API under the user's credentials.
    // We simulate the write and log it.
    const jiraCommentId = randomUUID(); // placeholder — real impl calls Jira REST
    logger.info("forge_confirm_post_approved", {
        run_id: runId,
        approver: approverId,
        ticket_key: draft.ticket_key,
        jira_comment_id: jiraCommentId,
    });
    // Consume CSRF token (one-time use)
    csrfTokens.delete(runId);
    return {
        status: 200,
        body: { run_id: runId, outcome: "posted", jira_comment_id: jiraCommentId },
    };
}
// ---------------------------------------------------------------------------
// Export CSRF token map (test-only access via package-private convention)
// ---------------------------------------------------------------------------
/** @internal — exposed for contract tests only */
export const _csrfTokens = csrfTokens;
