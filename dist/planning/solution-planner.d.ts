/**
 * Solution Planner
 *
 * Merges a ReadinessResult and a RepoMapResult into a single ActionPackage.
 * Surfaces conflicts when readiness says `ready` but repo confidence is low.
 */
import type { ReadinessResult, RepoMapResult, ActionPackage } from "../types/index.js";
import type { LLMAdapter } from "../llm/types.js";
/** Produces: {ticketKey}-{summary-slug}, e.g. ABC-123-improve-webhook-retry */
export declare function buildBranchName(ticketKey: string, summary: string): string;
/** Produces a valid OpenSpec change slug, e.g. abc-123-improve-webhook-retry */
export declare function buildOpenspecSlug(ticketKey: string, summary: string): string;
export interface PlannerInput {
    readiness: ReadinessResult;
    repoMap: RepoMapResult | null;
    summary: string;
    /** Optional LLM adapter — when provided and not degraded, groundPlan is called */
    llmAdapter?: LLMAdapter;
    /** Context block from RAG retrieval */
    contextBlock?: string;
    /** Fetched file contents keyed by path */
    fileContents?: Record<string, string>;
}
export declare function planActionPackage(input: PlannerInput): Promise<ActionPackage>;
