/**
 * Jira Comment Draft Emitter
 *
 * Produces a human-readable Jira comment draft from a ReadinessResult.
 * The draft is NEVER posted autonomously — it is returned to the caller
 * along with a `confirm_post_url` gate. Writing to Jira requires explicit
 * human confirmation.
 *
 * Every draft embeds the run_id so the originating analysis is traceable
 * in the evidence store.
 */
import type { ReadinessResult, CommentDraft } from "../types/index.js";
export interface DraftEmitterOptions {
    /**
     * Base URL used to construct the confirm_post_url.
     * E.g. "https://product-overlord.internal"
     */
    baseUrl?: string;
}
/**
 * Build a formatted Jira comment draft (Jira wiki-markup / plain text).
 * Embeds run_id, verdict, score, missing items, and clarification questions.
 * Returns a CommentDraft — caller must present this to the user and gate on
 * explicit confirmation before any Jira write.
 */
export declare function emitCommentDraft(result: ReadinessResult, run_id: string, opts?: DraftEmitterOptions): CommentDraft;
