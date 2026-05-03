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
import { mapTicketToComponents } from "./mapper.js";
import { ProfileRegistry, DEFAULT_STORY_PROFILE, DEFAULT_BUG_PROFILE, DEFAULT_TASK_PROFILE } from "../readiness/profile.js";
import { scoreTicket } from "../readiness/scorer.js";
import { applyQuestions } from "../readiness/clarification.js";
import { planActionPackage } from "../planning/solution-planner.js";
import { reviewActionPackage } from "../planning/reviewer.js";
import { emitOpenSpecArtifact } from "../planning/openspec-emitter.js";
import { evidenceStore } from "../evidence/store.js";
import { latencyTracker } from "../utils/latency.js";
import { logger } from "../utils/logger.js";
import { createLLMAdapter } from "../llm/index.js";
import { enrichReadinessPrompt } from "../llm/prompts.js";
import { retrieveChunks } from "../rag/retrieval.js";
import { fetchTopFiles } from "../rag/file-fetcher.js";
import { buildContext } from "../rag/context-builder.js";
import type { RetrievedChunk } from "../knowledge/types.js";
import type { LLMTrace } from "../llm/types.js";
import type { ReviewerConfig } from "../planning/reviewer.js";
import type { EmitterConfig } from "../planning/openspec-emitter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

const registry = new ProfileRegistry([
  DEFAULT_STORY_PROFILE,
  DEFAULT_BUG_PROFILE,
  DEFAULT_TASK_PROFILE,
]);

export async function runStage2Pipeline(input: Stage2Input): Promise<Stage2Result> {
  const { ticket, componentIndex, reviewerConfig, emitterConfig, kbStore, fileContentAdapter } = input;
  const ticketKey = ticket.ticket_key;
  const overallStart = Date.now();

  // ── LLM adapter (always created; mock when DEGRADED_LLM=true or no key) ──
  const llmAdapter = createLLMAdapter({
    apiKey: process.env["LLM_API_KEY"],
    baseUrl: process.env["LLM_BASE_URL"] ?? "https://api.openai.com/v1",
    model: process.env["LLM_MODEL"] ?? "gpt-4o-mini",
    embeddingModel: process.env["EMBEDDING_MODEL"] ?? "text-embedding-3-small",
    callsPerMinute: Number(process.env["LLM_CALLS_PER_MINUTE"] ?? 60),
    degraded: process.env["DEGRADED_LLM"] === "true",
  });

  const allLLMTraces: LLMTrace[] = [];
  let retrievedChunks: RetrievedChunk[] = [];

  // ── 0. RAG retrieval (task 5.3) — non-blocking, 2s timeout ───────────────
  if (kbStore) {
    const projectKey = ticketKey.split("-")[0] ?? ticketKey;
    const query = `${ticket.summary} ${ticket.description ?? ""}`.trim();
    retrievedChunks = await retrieveChunks(query, projectKey, kbStore, llmAdapter);
  }

  // ── 1. Parallel branches ──────────────────────────────────────────────────
  const readinessStart = Date.now();
  const repoStart = Date.now();

  const [readinessSettled, repoSettled] = await Promise.allSettled([
    // Readiness branch (synchronous internally, wrapped for uniform handling)
    Promise.resolve().then(() => {
      const { profile, source } = registry.resolve(ticket.ticket_key.split("-")[0], ticket.ticket_type);
      const scored = scoreTicket({ ticket, profile, profileSource: source });
      return applyQuestions(scored, profile);
    }),
    // Repo-mapping branch
    Promise.resolve().then(() => {
      return mapTicketToComponents({ ticket, index: componentIndex });
    }),
  ]);

  latencyTracker.record("readiness-branch", Date.now() - readinessStart);
  latencyTracker.record("repo-mapping-branch", Date.now() - repoStart);

  // ── 2. Extract branch results ─────────────────────────────────────────────
  let readinessResult: import("../types/index.js").ReadinessResult | null = null;
  let repoMapFailureReason: string | undefined;

  if (readinessSettled.status === "fulfilled") {
    readinessResult = readinessSettled.value;
  } else {
    logger.error("readiness_branch_failed", { ticket_key: ticketKey, error: String(readinessSettled.reason) });
    // Without readiness we cannot plan — bail out
    const bundleId = evidenceStore.save({
      ticket_key: ticketKey,
      readiness: null,
      draft: null,
      traces: [],
      metadata: { stage2_failure: "readiness_branch_failed", reason: String(readinessSettled.reason) },
    });
    return {
      ticket_key: ticketKey,
      actionPackage: null,
      reviewerVerdict: null,
      emitResult: null,
      evidenceBundleId: bundleId,
      repoMapFailureReason: "readiness_branch_failed",
      llm_traces: [],
      retrieved_chunks: retrievedChunks,
    };
  }

  let repoMap: import("../types/index.js").RepoMapResult | null = null;
  if (repoSettled.status === "fulfilled") {
    repoMap = repoSettled.value;
  } else {
    repoMapFailureReason = String(repoSettled.reason);
    logger.warn("repo_mapping_branch_failed", { ticket_key: ticketKey, error: repoMapFailureReason });
    // Readiness branch continues; repo_map is null
  }

  // ── 2b. LLM enrichment pass (task 5.4) — 10s timeout, additive only ─────
  const contextBlock = buildContext(retrievedChunks, []).contextBlock;

  if (!readinessResult.readiness_status || readinessResult.readiness_status !== "blocked") {
    try {
      const enrichSchema = {
        type: "object",
        properties: {
          additional_missing_items: { type: "array" },
          additional_questions_for_pm: { type: "array" },
          additional_questions_for_engineer: { type: "array" },
          additional_questions_for_qa: { type: "array" },
        },
      };
      interface EnrichedOutput {
        additional_missing_items: { dimension: string; severity: string; reason: string }[];
        additional_questions_for_pm: { question: string; justification: string }[];
        additional_questions_for_engineer: { question: string; justification: string }[];
        additional_questions_for_qa: { question: string; justification: string }[];
      }
      const prompt = enrichReadinessPrompt({
        ticketKey,
        ticketSummary: ticket.summary,
        acceptanceCriteria: ticket.acceptance_criteria,
        description: ticket.description,
        contextBlock,
        deterministicResult: JSON.stringify(readinessResult),
      });
      const { result, trace } = await Promise.race([
        llmAdapter.complete<EnrichedOutput>(prompt, enrichSchema),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LLM enrichment timeout")), 10_000)),
      ]);
      allLLMTraces.push(trace);

      // Merge LLM additions — additive only, never override deterministic result
      if (result.additional_missing_items?.length > 0) {
        readinessResult = {
          ...readinessResult,
          missing_items: [
            ...readinessResult.missing_items,
            ...result.additional_missing_items.map((item) => ({
              dimension: item.dimension,
              severity: (item.severity ?? "medium") as import("../types/index.js").Severity,
              reason: item.reason,
              source: "llm" as const,
            })),
          ],
        };
      }
      if (result.additional_questions_for_pm?.length > 0) {
        readinessResult = {
          ...readinessResult,
          questions_for_pm: [
            ...readinessResult.questions_for_pm,
            ...result.additional_questions_for_pm.map((q) => q.question),
          ],
        };
      }
      if (result.additional_questions_for_engineer?.length > 0) {
        readinessResult = {
          ...readinessResult,
          questions_for_engineer: [
            ...readinessResult.questions_for_engineer,
            ...result.additional_questions_for_engineer.map((q) => q.question),
          ],
        };
      }
      if (result.additional_questions_for_qa?.length > 0) {
        readinessResult = {
          ...readinessResult,
          questions_for_qa: [
            ...readinessResult.questions_for_qa,
            ...result.additional_questions_for_qa.map((q) => q.question),
          ],
        };
      }
    } catch (err) {
      logger.warn("llm_enrichment_failed", { ticket_key: ticketKey, error: String(err) });
      // Fall through — deterministic result unchanged
    }
  }

  // ── 2c. Fetch top files (task 5.6) ────────────────────────────────────────
  let fetchedFileContents: Record<string, string> = {};
  if (fileContentAdapter && repoMap && repoMap.candidate_files.length > 0) {
    const candidates = repoMap.candidate_files.map((f) => {
      const parts = f.path.split("/");
      return {
        owner: "unknown",
        repo: parts[0] ?? "unknown",
        path: f.path,
        confidence: repoMap.candidate_components[0]?.confidence ?? 0.5,
      };
    });
    try {
      const fetched = await fetchTopFiles(candidates, fileContentAdapter, 3);
      fetchedFileContents = Object.fromEntries(fetched.map((f) => [f.path, f.content]));
    } catch (err) {
      logger.warn("fetch_top_files_failed", { ticket_key: ticketKey, error: String(err) });
    }
  }

  // ── 3. Solution Planner merge ─────────────────────────────────────────────
  const actionPackage = await planActionPackage({
    readiness: readinessResult,
    repoMap,
    summary: ticket.summary,
    llmAdapter,
    contextBlock,
    fileContents: fetchedFileContents,
  });

  // ── 4. Reviewer gate ──────────────────────────────────────────────────────
  const verdict = reviewActionPackage(actionPackage, reviewerConfig);

  // ── 5. OpenSpec artifact emission ─────────────────────────────────────────
  const emitResult = emitOpenSpecArtifact(actionPackage, verdict, emitterConfig);

  // ── 6. Evidence store ─────────────────────────────────────────────────────
  const bundleId = evidenceStore.save({
    ticket_key: ticketKey,
    readiness: readinessResult,
    draft: null,
    traces: [],
    llm_traces: allLLMTraces,
    retrieved_chunks: retrievedChunks,
    metadata: {
      stage: "stage2",
      reviewer_approved: verdict.approved,
      repo_map_failure: repoMapFailureReason ?? null,
      latency_ms: Date.now() - overallStart,
    },
  });

  logger.info("stage2_pipeline_complete", {
    ticket_key: ticketKey,
    readiness_status: readinessResult.readiness_status,
    reviewer_approved: verdict.approved,
    repo_map_confidence: actionPackage.repo_map_confidence,
    llm_traces: allLLMTraces.length,
    retrieved_chunks: retrievedChunks.length,
    latency_ms: Date.now() - overallStart,
  });

  return {
    ticket_key: ticketKey,
    actionPackage,
    reviewerVerdict: verdict,
    emitResult,
    evidenceBundleId: bundleId,
    repoMapFailureReason,
    llm_traces: allLLMTraces,
    retrieved_chunks: retrievedChunks,
  };
}
