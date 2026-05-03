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
import { IngestionOrchestrator } from "../adapters/ingestion-orchestrator.js";
import type { IngestIssueResponse, IngestBoardResponse, GetPlanResponse, ConfirmPostResponse } from "./types.js";
/** Maximum allowed response payload before truncation kicks in */
export declare const PAYLOAD_LIMIT_BYTES: number;
/** How long we wait for the orchestrator before returning a timeout envelope */
export declare const ENDPOINT_TIMEOUT_MS = 30000;
export declare function getOrchestrator(): IngestionOrchestrator;
/** Inject a mock orchestrator in tests */
export declare function setOrchestrator(o: IngestionOrchestrator): void;
export interface ForgeRequest {
    headers: Record<string, string | undefined>;
    params?: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
    body?: unknown;
}
export interface ForgeResponse<T = unknown> {
    status: number;
    body: T;
}
export declare function handleIngestIssue(req: ForgeRequest): Promise<ForgeResponse<IngestIssueResponse>>;
export declare function handleIngestBoard(req: ForgeRequest): Promise<ForgeResponse<IngestBoardResponse>>;
export declare function handleGetPlan(req: ForgeRequest): Promise<ForgeResponse<GetPlanResponse>>;
export declare function handleConfirmPost(req: ForgeRequest): Promise<ForgeResponse<ConfirmPostResponse>>;
/** @internal — exposed for contract tests only */
export declare const _csrfTokens: Map<string, string>;
