/**
 * Forge Rovo Agent (Tasks 3.1 – 3.6)
 *
 * Implements the four agent action surfaces that Jira users interact with.
 * In a live Forge app each function would be the handler of a Forge UI Kit
 * or Custom UI action.  Here they are pure TypeScript so they can be
 * integration-tested without a Forge runtime.
 *
 * 3.6 — No autonomous Jira writes: every action that would write to Jira
 * MUST go through the confirm_post_url gate and return a "Post / Discard"
 * prompt.  This invariant is enforced by never calling handleConfirmPost
 * internally — only the human-facing confirm step may call it.
 */
import type { AnalyseTicketAction, BoardSweepAction, ConfirmCommentAction, ForgeEnvelope, IngestBoardResponse } from "./types.js";
export interface AnalyseTicketResult {
    envelope: ForgeEnvelope;
    /** Present when deep_analysis=true and research subagent was invoked */
    research_session_id?: string;
    autonomous_write: false;
}
export declare function analyseTicketAction(action: AnalyseTicketAction, authToken: string, userId?: string): Promise<AnalyseTicketResult>;
export interface BoardSweepResult {
    response: IngestBoardResponse;
    /** Pass this as cursor to load the next page */
    next_cursor?: string;
    has_more: boolean;
    autonomous_write: false;
}
export declare function boardSweepAction(action: BoardSweepAction, authToken: string): Promise<BoardSweepResult>;
export type ConfirmationChoice = "post" | "discard";
export interface ConfirmCommentResult {
    choice: ConfirmationChoice;
    outcome: "posted" | "discarded" | "error";
    jira_comment_id?: string;
    run_id: string;
    error?: string;
}
export declare function confirmCommentAction(action: ConfirmCommentAction, choice: ConfirmationChoice, authToken: string): Promise<ConfirmCommentResult>;
export interface ForgeAgentManifest {
    key: string;
    name: string;
    description: string;
    actions: {
        key: string;
        name: string;
        description: string;
    }[];
    no_autonomous_jira_writes: true;
}
export declare function getForgeAgentManifest(): ForgeAgentManifest;
