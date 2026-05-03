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
import { randomUUID } from "crypto";
import { evidenceStore } from "../evidence/store.js";
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// 2.2  Reflection queue store
// ---------------------------------------------------------------------------
const MAX_QUEUE_SIZE = 500;
const reflectionQueue = [];
export function getReflectionQueue() {
    return reflectionQueue;
}
export function getCandidateById(candidateId) {
    return reflectionQueue.find((c) => c.candidate_id === candidateId);
}
function enqueue(candidate) {
    if (reflectionQueue.length >= MAX_QUEUE_SIZE) {
        // Drop oldest non-reviewed candidate
        const oldestIdx = reflectionQueue.findIndex((c) => c.status === "pending");
        if (oldestIdx !== -1) {
            logger.warn("reflection_queue_overflow_drop", {
                dropped_id: reflectionQueue[oldestIdx].candidate_id,
            });
            reflectionQueue.splice(oldestIdx, 1);
        }
    }
    reflectionQueue.push(candidate);
}
/** @internal — clear queue in tests */
export function _clearReflectionQueue() {
    reflectionQueue.length = 0;
}
const pendingPolicyDeltas = [];
const pendingRepoMemoryDeltas = [];
export function getPendingPolicyDeltas() {
    return pendingPolicyDeltas;
}
export function getPendingRepoMemoryDeltas() {
    return pendingRepoMemoryDeltas;
}
/** @internal */
export function _clearPromotionStores() {
    pendingPolicyDeltas.length = 0;
    pendingRepoMemoryDeltas.length = 0;
}
/**
 * Enqueue a reflection job asynchronously.  Returns immediately; analysis
 * runs in the background via a queued microtask so it never blocks the caller.
 */
export function enqueueReflection(trigger) {
    // Fire-and-forget — caller is not awaited
    queueMicrotask(() => {
        _runReflection(trigger).catch((err) => {
            logger.error("reflection_agent_error", { run_id: trigger.run_id, error: String(err) });
        });
    });
}
async function _runReflection(trigger) {
    const bundle = evidenceStore.get(trigger.run_id);
    if (!bundle) {
        logger.warn("reflection_agent_bundle_not_found", { run_id: trigger.run_id });
        return;
    }
    const originalVerdict = bundle.verdict ??
        bundle.scorer_output?.readiness_status ??
        "needs_clarification";
    const originalTopComponents = [];
    const suggestedPolicyUpdate = trigger.corrected_verdict && trigger.corrected_verdict !== originalVerdict
        ? {
            hint: `verdict changed from ${originalVerdict} to ${trigger.corrected_verdict}`,
            dimension_weights_review: true,
        }
        : {};
    const suggestedRepoUpdate = trigger.actual_components && trigger.actual_components.length > 0
        ? {
            actual_components: trigger.actual_components,
            original_top_components: originalTopComponents,
        }
        : {};
    const candidate = {
        candidate_id: randomUUID(),
        run_id: trigger.run_id,
        trigger: trigger.type,
        original_verdict: originalVerdict,
        corrected_verdict: trigger.corrected_verdict ?? null,
        original_top_components: originalTopComponents,
        actual_components: trigger.actual_components ?? [],
        evidence_delta: { trigger: trigger.type },
        suggested_policy_update: suggestedPolicyUpdate,
        suggested_repo_update: suggestedRepoUpdate,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
    };
    enqueue(candidate);
    logger.info("reflection_candidate_created", {
        candidate_id: candidate.candidate_id,
        run_id: trigger.run_id,
        trigger: trigger.type,
    });
}
/** Approve a candidate: writes policy + repo memory deltas (2.4 + 2.5) */
export function approveCandidate(candidateId, reviewerAccountId) {
    const candidate = getCandidateById(candidateId);
    if (!candidate)
        throw new Error(`Candidate ${candidateId} not found`);
    if (candidate.status !== "pending") {
        throw new Error(`Candidate ${candidateId} is already ${candidate.status}`);
    }
    const now = new Date().toISOString();
    candidate.status = "approved";
    candidate.reviewed_by = reviewerAccountId;
    candidate.reviewed_at = now;
    // 2.4  Readiness profile delta
    let policyDeltaId;
    if (Object.keys(candidate.suggested_policy_update).length > 0) {
        const delta = {
            candidate_id: candidateId,
            reviewer: reviewerAccountId,
            timestamp: now,
            field_updates: candidate.suggested_policy_update,
        };
        pendingPolicyDeltas.push(delta);
        policyDeltaId = candidateId;
    }
    // 2.5  Repo memory delta
    let repoDeltaId;
    if (Object.keys(candidate.suggested_repo_update).length > 0) {
        const delta = {
            candidate_id: candidateId,
            reviewer: reviewerAccountId,
            timestamp: now,
            component_updates: candidate.suggested_repo_update,
        };
        pendingRepoMemoryDeltas.push(delta);
        repoDeltaId = candidateId;
    }
    logger.info("reflection_candidate_approved", {
        candidate_id: candidateId,
        reviewer: reviewerAccountId,
        policy_delta: !!policyDeltaId,
        repo_delta: !!repoDeltaId,
    });
    return {
        candidate_id: candidateId,
        status: "approved",
        reviewed_by: reviewerAccountId,
        reviewed_at: now,
        policy_delta_id: policyDeltaId,
        repo_delta_id: repoDeltaId,
    };
}
/** Reject a candidate: no memory writes, provenance still recorded */
export function rejectCandidate(candidateId, reviewerAccountId) {
    const candidate = getCandidateById(candidateId);
    if (!candidate)
        throw new Error(`Candidate ${candidateId} not found`);
    if (candidate.status !== "pending") {
        throw new Error(`Candidate ${candidateId} is already ${candidate.status}`);
    }
    const now = new Date().toISOString();
    candidate.status = "rejected";
    candidate.reviewed_by = reviewerAccountId;
    candidate.reviewed_at = now;
    logger.info("reflection_candidate_rejected", {
        candidate_id: candidateId,
        reviewer: reviewerAccountId,
    });
    return {
        candidate_id: candidateId,
        status: "rejected",
        reviewed_by: reviewerAccountId,
        reviewed_at: now,
    };
}
