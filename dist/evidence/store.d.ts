/**
 * Evidence Store
 *
 * Persists an evidence bundle for every analysis run.
 * Each bundle is keyed by a UUID run_id and retained for ≥ 90 days.
 *
 * Storage in this implementation is an in-process Map (sufficient for the
 * current stage). The interface is designed so a persistent backend
 * (SQLite, Redis, file-system) can be swapped in without changing callers.
 */
import type { AdapterTrace, CanonicalTicket, ReadinessResult } from "../types/index.js";
import type { LLMTrace } from "../llm/types.js";
import type { RetrievedChunk } from "../knowledge/types.js";
export interface EvidenceBundle {
    /** Unique UUID for this analysis run */
    run_id: string;
    /** ISO-8601 timestamp */
    timestamp: string;
    /** Human-readable trigger (e.g. "board_sweep", "direct_key:ABC-1") */
    trigger: string;
    /** All adapter traces emitted during this run */
    adapter_traces: AdapterTrace[];
    /** Normalised ticket as fed to the scorer */
    canonical_ticket: CanonicalTicket;
    /** Inputs passed to the scorer */
    scorer_input: {
        profile_id: string;
        profile_source: "project" | "default";
    };
    /** Full scorer output */
    scorer_output: ReadinessResult;
    /** Verdict shorthand (mirrors scorer_output.readiness_status) */
    verdict: ReadinessResult["readiness_status"];
    /** ID of the comment draft produced (if any) */
    comment_draft_id: string | null;
    /** LLM call traces emitted during this run (empty when degraded) */
    llm_traces?: LLMTrace[];
    /** KB chunks retrieved for RAG context during this run */
    retrieved_chunks?: RetrievedChunk[];
}
export declare class EvidenceStore {
    private readonly store;
    /** Persist a new evidence bundle; returns the assigned run_id. */
    persist(bundle: Omit<EvidenceBundle, "run_id" | "timestamp">): EvidenceBundle;
    /** Retrieve a bundle by run_id. Returns undefined if not found or expired. */
    get(run_id: string): EvidenceBundle | undefined;
    /**
     * Lightweight save() for stage-2 usage — accepts a minimal payload object,
     * assigns a UUID run_id, and returns it.
     * For callers that don't have a full EvidenceBundle shape (e.g. stage-2 orchestrator).
     */
    save(payload: {
        ticket_key: string;
        [key: string]: unknown;
    }): string;
    /** Number of live (non-expired) bundles in store. */
    get size(): number;
    /** Remove all expired entries. */
    private _evict;
}
/** Singleton default store shared across the process. */
export declare const evidenceStore: EvidenceStore;
