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

import {
  handleIngestIssue,
  handleIngestBoard,
  handleConfirmPost,
} from "./endpoints.js";
import { forgeInstrumentation } from "./instrumentation.js";
import { createResearchSubagentConfig } from "./subagent.js";
import { logger } from "../utils/logger.js";
import type {
  AnalyseTicketAction,
  BoardSweepAction,
  ConfirmCommentAction,
  ForgeEnvelope,
  IngestBoardResponse,
} from "./types.js";
import type { ForgeRequest } from "./endpoints.js";

// ---------------------------------------------------------------------------
// Helper — build a ForgeRequest from a user-supplied action payload
// ---------------------------------------------------------------------------

function toForgeReq(authToken: string, body?: unknown, params?: Record<string, string>, query?: Record<string, string>): ForgeRequest {
  return {
    headers: { authorization: `Bearer ${authToken}` },
    body,
    params,
    query,
  };
}

// ---------------------------------------------------------------------------
// 3.2  "Analyse this ticket" → summary card
// ---------------------------------------------------------------------------

export interface AnalyseTicketResult {
  envelope: ForgeEnvelope;
  /** Present when deep_analysis=true and research subagent was invoked */
  research_session_id?: string;
  autonomous_write: false; // always false — 3.6 invariant
}

export async function analyseTicketAction(
  action: AnalyseTicketAction,
  authToken: string,
  userId = "unknown"
): Promise<AnalyseTicketResult> {
  const start = Date.now();
  const req = toForgeReq(authToken, {
    issue_key: action.issue_key,
    base_url: action.base_url,
  });

  const response = await handleIngestIssue(req);
  const latency = Date.now() - start;

  const status = response.body.status ?? "ok";
  forgeInstrumentation.recordAction({
    action: "analyse_ticket",
    latency_ms: latency,
    status: status === "timeout" ? "timeout" : status === "truncated" ? "truncated" : "ok",
    payload_bytes: Buffer.byteLength(JSON.stringify(response.body), "utf8"),
    truncated: status === "truncated",
  });

  logger.info("forge_agent_analyse_ticket", {
    issue_key: action.issue_key,
    run_id: response.body.run_id,
    verdict: response.body.verdict,
    latency_ms: latency,
  });

  // Opt-in research subagent (task 5.3)
  let researchSessionId: string | undefined;
  if (action.deep_analysis) {
    try {
      const cfg = createResearchSubagentConfig(
        action.issue_key.split("-")[0]!,
        action.issue_key,
        userId
      );
      researchSessionId = cfg.session_id;
      logger.info("forge_agent_research_subagent_invoked", {
        issue_key: action.issue_key,
        session_id: cfg.session_id,
      });
    } catch (err) {
      logger.warn("forge_agent_research_subagent_unavailable", { error: String(err) });
    }
  }

  return {
    envelope: response.body,
    research_session_id: researchSessionId,
    autonomous_write: false,
  };
}

// ---------------------------------------------------------------------------
// 3.3  Board sweep with "load more"
// ---------------------------------------------------------------------------

export interface BoardSweepResult {
  response: IngestBoardResponse;
  /** Pass this as cursor to load the next page */
  next_cursor?: string;
  has_more: boolean;
  autonomous_write: false;
}

export async function boardSweepAction(
  action: BoardSweepAction,
  authToken: string
): Promise<BoardSweepResult> {
  const start = Date.now();
  const query: Record<string, string> = {
    id: String(action.board_id),
    page_size: String(action.page_size ?? 25),
  };
  if (action.cursor) query["cursor"] = action.cursor;
  if (action.base_url) query["base_url"] = action.base_url;

  const req = toForgeReq(authToken, undefined, { id: String(action.board_id) }, query);
  const response = await handleIngestBoard(req);
  const latency = Date.now() - start;

  forgeInstrumentation.recordAction({
    action: "board_sweep",
    latency_ms: latency,
    status: response.body.status === "timeout" ? "timeout" : response.body.status === "truncated" ? "truncated" : "ok",
    payload_bytes: Buffer.byteLength(JSON.stringify(response.body), "utf8"),
    truncated: response.body.status === "truncated",
  });

  logger.info("forge_agent_board_sweep", {
    board_id: action.board_id,
    issues_returned: response.body.total_issues_on_page,
    has_more: !!response.body.next_cursor,
  });

  return {
    response: response.body,
    next_cursor: response.body.next_cursor,
    has_more: !!response.body.next_cursor,
    autonomous_write: false,
  };
}

// ---------------------------------------------------------------------------
// 3.4  "Post comment / Discard" confirmation prompt
//      This is the ONLY path that can write to Jira.  The user must
//      explicitly call confirmCommentAction — no automatic posting.
// ---------------------------------------------------------------------------

export type ConfirmationChoice = "post" | "discard";

export interface ConfirmCommentResult {
  choice: ConfirmationChoice;
  outcome: "posted" | "discarded" | "error";
  jira_comment_id?: string;
  run_id: string;
  error?: string;
}

export async function confirmCommentAction(
  action: ConfirmCommentAction,
  choice: ConfirmationChoice,
  authToken: string
): Promise<ConfirmCommentResult> {
  if (choice === "discard") {
    logger.info("forge_agent_comment_discarded", { run_id: action.run_id });
    return { choice: "discard", outcome: "discarded", run_id: action.run_id };
  }

  // choice === "post" — delegate to the human-gate endpoint
  const req = toForgeReq(
    authToken,
    {
      csrf_token: action.csrf_token,
      approver_account_id: action.approver_account_id,
    },
    { run_id: action.run_id }
  );

  const response = await handleConfirmPost(req);
  logger.info("forge_agent_comment_confirm_result", {
    run_id: action.run_id,
    outcome: response.body.outcome,
  });

  return {
    choice: "post",
    outcome: response.body.outcome,
    jira_comment_id: response.body.jira_comment_id,
    run_id: action.run_id,
    error: response.body.error,
  };
}

// ---------------------------------------------------------------------------
// 3.1  Forge manifest definition (task 3.1 — scaffold / documentation object)
// ---------------------------------------------------------------------------

export interface ForgeAgentManifest {
  key: string;
  name: string;
  description: string;
  actions: { key: string; name: string; description: string }[];
  no_autonomous_jira_writes: true;
}

export function getForgeAgentManifest(): ForgeAgentManifest {
  return {
    key: "product-overlord-rovo-agent",
    name: "Product Overlord",
    description:
      "Analyses Jira tickets for readiness, maps affected components, and proposes " +
      "an action package. All Jira writes require explicit human confirmation.",
    actions: [
      {
        key: "analyse-ticket",
        name: "Analyse this ticket",
        description: "Runs the readiness + repo-mapping pipeline on the current ticket and displays a summary card.",
      },
      {
        key: "board-sweep",
        name: "Sweep board",
        description: "Runs readiness analysis on every ticket in the board (paginated).",
      },
      {
        key: "confirm-comment",
        name: "Post analysis comment",
        description: "Posts the readiness analysis as a Jira comment — requires explicit user confirmation.",
      },
      {
        key: "deep-analysis",
        name: "Deep analysis (research subagent)",
        description: "Opt-in heavyweight analysis using an isolated research subagent (30/day limit).",
      },
    ],
    no_autonomous_jira_writes: true,
  };
}
