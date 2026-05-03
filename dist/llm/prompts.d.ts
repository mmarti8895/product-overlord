/**
 * Prompt registry.
 * All prompts are typed template functions — no external files, no I/O.
 */
import type { PromptContext } from "./types.js";
/**
 * Prompt for enriching a deterministic readiness result with LLM analysis.
 * Returns JSON matching EnrichedReadinessOutput schema.
 */
export declare function enrichReadinessPrompt(ctx: PromptContext): string;
/**
 * Prompt for grounding the solution plan with code context.
 * Returns JSON matching GroundedPlanOutput schema.
 */
export declare function groundPlanPrompt(ctx: PromptContext): string;
