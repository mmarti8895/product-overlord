/**
 * Stage-2 Parallel Orchestrator
 *
 * After canonical normalisation, runs readiness and repo-mapping branches
 * in parallel (Promise.allSettled), merges via Solution Planner, validates
 * via Reviewer, and emits the OpenSpec artifact.
 *
 * Invariants:
 *   - Both branches start simultaneously — neither waits for the other
 *   - If repo-mapping branch fails, readiness continues; repo_map is null
 *   - Evidence from both branches (or failure reasons) always recorded
 */
import type { CanonicalTicket } from "../types/index.js";
import type { ComponentIndex } from "./component-indexer.js";
import type { RetrievedChunk } from "../knowledge/types.js";
import type { LLMTrace } from "../llm/types.js";
import type { ReviewerConfig } from "../planning/reviewer.js";
import type { EmitterConfig } from "../planning/openspec-emitter.js";
export interface Stage2Input {
    ticket: CanonicalTicket;
    /** Pass null to simulate repo-index unavailable */
    componentIndex: ComponentIndex | null;
    reviewerConfig?: ReviewerConfig;
    emitterConfig?: EmitterConfig;
    /** Optional KB store for RAG retrieval (skipped when absent) */
    kbStore?: import("../knowledge/store.js").KBStore;
    /** Optional repo adapter for fetching file contents */
    fileContentAdapter?: import("../rag/file-fetcher.js").FileContentAdapter;
}
export interface Stage2Result {
    ticket_key: string;
    actionPackage: import("../types/index.js").ActionPackage | null;
    reviewerVerdict: import("../types/index.js").ReviewerVerdict | null;
    emitResult: import("../planning/openspec-emitter.js").EmitResult | null;
    evidenceBundleId: string;
    /** Set when repo-mapping branch failed */
    repoMapFailureReason?: string;
    /** LLM traces collected during this run */
    llm_traces: LLMTrace[];
    /** KB chunks retrieved for RAG context */
    retrieved_chunks: RetrievedChunk[];
}
export declare function runStage2Pipeline(input: Stage2Input): Promise<Stage2Result>;
