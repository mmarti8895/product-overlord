/**
 * Deep-Research Subagent (Tasks 5.1 – 5.4)
 *
 * 5.1  Isolated MCP session; all findings tagged `source: "deep-research"`.
 * 5.2  Rate limiter: 30 req/user/calendar day UTC; clear error on limit exceeded.
 * 5.3  15-minute timeout: cancel job, return `status: timeout` partial, log to
 *      evidence store.
 * 5.4  Tests in src/tests/integration/deep-research.test.ts
 */
import type { ReadinessResult } from "../types/index.js";
export type DeepResearchStatus = "ok" | "timeout" | "rate_limited" | "error";
/** A single piece of evidence gathered by the deep-research subagent. */
export interface DeepResearchFinding {
    /** Always "deep-research" — used for filtering / attribution */
    source: "deep-research";
    /** Human-readable finding */
    text: string;
    /** Confidence 0–1 */
    confidence: number;
    /** Which dimension this finding relates to */
    dimension?: string;
}
export interface DeepResearchResult {
    status: DeepResearchStatus;
    /** Present when status is "ok" */
    findings?: DeepResearchFinding[];
    /**
     * Partial readiness result enriched with deep-research findings.
     * Present even on timeout (contains whatever completed before cutoff).
     */
    enriched_readiness?: Partial<ReadinessResult>;
    /** Elapsed time in milliseconds */
    elapsed_ms: number;
    /** Session ID used — for asserting isolation */
    session_id: string;
    /** Evidence store run_id where this result was logged */
    evidence_run_id?: string;
    /** Human-readable error / limit message */
    message?: string;
}
/**
 * Options for a deep-research analysis job.
 */
export interface DeepResearchOptions {
    projectKey: string;
    issueKey: string;
    userId: string;
    /** Operational subagent session ID — used to assert isolation */
    operationalSessionId: string;
    /**
     * The core analysis function to run inside the isolated session.
     * Receives the fresh session_id; must return enriched readiness.
     * In production this calls an LLM/MCP tool chain; in tests it's a stub.
     */
    analysisJob: (sessionId: string) => Promise<{
        findings: DeepResearchFinding[];
        enriched_readiness: Partial<ReadinessResult>;
    }>;
    /** Override timeout for tests (default: RESEARCH_SUBAGENT_TIMEOUT_MS) */
    timeoutMs?: number;
}
/**
 * Run a deep-research analysis job with:
 *   - a fresh, isolated MCP session (5.1)
 *   - rate-limit enforcement (5.2)
 *   - 15-minute timeout (5.3)
 *   - evidence store logging on all exit paths
 */
export declare function runDeepResearch(opts: DeepResearchOptions): Promise<DeepResearchResult>;
