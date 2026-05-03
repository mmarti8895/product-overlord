/**
 * Reflection Agent & Memory-Promotion Workflow (Tasks 2.1 – 2.7)
 *
 * Reflection Agent (2.1)
 *   - Async, non-blocking; triggered on correction / ticket completion /
 *     declined plan
 *   - Reads the evidence bundle, builds a ReflectionCandidate, enqueues it
 *   - Never touches live policy or repo memory directly
 *
 * Reflection Queue Store (2.2)
 *   - In-process store of pending candidates
 *   - Oldest candidate dropped when queue exceeds MAX_QUEUE_SIZE
 *
 * Human-review UI (2.3)
 *   - Pure function: approve(candidateId) / reject(candidateId)
 *   - Returns the updated candidate with provenance
 *
 * Promotion writes (2.4 + 2.5)
 *   - Approved candidate → readiness profile delta (provenance attached)
 *   - Approved candidate → repo memory delta (provenance attached)
 *   - Live policy and repo memory unchanged until approval (2.6 invariant)
 *
 * Tests (2.6 + 2.7) live in src/tests/unit/reflection.test.ts
 */
import type { ReadinessStatus } from "../types/index.js";
export type ReflectionStatus = "pending" | "approved" | "rejected";
export interface ReflectionCandidate {
    candidate_id: string;
    run_id: string;
    /** Trigger that created this candidate */
    trigger: "correction" | "ticket_completion" | "declined_plan";
    original_verdict: ReadinessStatus;
    corrected_verdict: ReadinessStatus | null;
    original_top_components: string[];
    actual_components: string[];
    /** Evidence delta between original and corrected analysis */
    evidence_delta: Record<string, unknown>;
    /** Suggested update to readiness profile (field-level delta) */
    suggested_policy_update: Record<string, unknown>;
    /** Suggested update to repo memory (component-level delta) */
    suggested_repo_update: Record<string, unknown>;
    status: ReflectionStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
}
export declare function getReflectionQueue(): readonly ReflectionCandidate[];
export declare function getCandidateById(candidateId: string): ReflectionCandidate | undefined;
/** @internal — clear queue in tests */
export declare function _clearReflectionQueue(): void;
export interface PolicyDelta {
    candidate_id: string;
    reviewer: string;
    timestamp: string;
    field_updates: Record<string, unknown>;
}
export interface RepoMemoryDelta {
    candidate_id: string;
    reviewer: string;
    timestamp: string;
    component_updates: Record<string, unknown>;
}
export declare function getPendingPolicyDeltas(): readonly PolicyDelta[];
export declare function getPendingRepoMemoryDeltas(): readonly RepoMemoryDelta[];
/** @internal */
export declare function _clearPromotionStores(): void;
export interface ReflectionTrigger {
    type: "correction" | "ticket_completion" | "declined_plan";
    run_id: string;
    /** For correction: the human-provided corrected verdict */
    corrected_verdict?: ReadinessStatus;
    /** For correction: the actual components the developer touched */
    actual_components?: string[];
}
/**
 * Enqueue a reflection job asynchronously.  Returns immediately; analysis
 * runs in the background via a queued microtask so it never blocks the caller.
 */
export declare function enqueueReflection(trigger: ReflectionTrigger): void;
export interface ReviewResult {
    candidate_id: string;
    status: ReflectionStatus;
    reviewed_by: string;
    reviewed_at: string;
    policy_delta_id?: string;
    repo_delta_id?: string;
}
/** Approve a candidate: writes policy + repo memory deltas (2.4 + 2.5) */
export declare function approveCandidate(candidateId: string, reviewerAccountId: string): ReviewResult;
/** Reject a candidate: no memory writes, provenance still recorded */
export declare function rejectCandidate(candidateId: string, reviewerAccountId: string): ReviewResult;
