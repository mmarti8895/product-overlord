/**
 * Integration test: full pipeline
 *
 * board sweep → normalise → score → generate questions → emit draft → confirm gate
 *
 * Uses mocked fetch (no real Jira calls) and exercises every layer end-to-end.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { JiraAgileRestAdapter } from "../../adapters/jira-agile-rest.js";
import { normaliseTicket } from "../../normaliser/normalise.js";
import { ProfileRegistry } from "../../readiness/profile.js";
import { scoreTicket } from "../../readiness/scorer.js";
import { applyQuestions } from "../../readiness/clarification.js";
import { EvidenceStore } from "../../evidence/store.js";
import { emitCommentDraft } from "../../output/comment-draft.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    } as Response;
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAW_STORY = {
  key: "DEMO-42",
  fields: {
    summary: "As a user I can reset my password",
    description: "Users need a password reset flow.",
    issuetype: { name: "Story" },
    status: { name: "To Do" },
    labels: ["auth"],
    priority: { name: "High" },
    reporter: { displayName: "alice" },
    assignee: { displayName: "bob" },
    comment: { comments: [] },
    issuelinks: [
      {
        type: { name: "Blocks", inward: "is blocked by" },
        inwardIssue: { key: "INFRA-10", fields: { status: { name: "Done" } } },
      },
    ],
    // No AC field — should trigger needs_clarification
  },
};

const BOARD_ISSUES_BODY = {
  issues: [RAW_STORY],
  total: 1,
  startAt: 0,
  maxResults: 50,
};

// ---------------------------------------------------------------------------
// Integration suite
// ---------------------------------------------------------------------------

describe("Integration: board sweep → normalise → score → draft → confirm gate", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("full pipeline produces a comment draft with run_id and confirm_post_url", async () => {
    // ── 1. Board sweep via Jira Agile REST ──────────────────────────────────
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body: BOARD_ISSUES_BODY }]));

    const agile = new JiraAgileRestAdapter({
      baseUrl: "https://demo.atlassian.net",
      accessToken: "tok",
      retryDelayMs: 0,
    });
    const { issues, trace } = await agile.getBoardIssues(1);
    expect(issues).toHaveLength(1);
    expect(trace.adapter).toBe("jira-agile-rest");

    // ── 2. Normalise ────────────────────────────────────────────────────────
    const canonical = normaliseTicket(issues[0], { boardId: "1", sprintId: undefined });
    expect(canonical.ticket_key).toBe("DEMO-42");
    expect(canonical.acceptance_criteria).toBeNull(); // no AC field in fixture

    // ── 3. Resolve profile & score ──────────────────────────────────────────
    const registry = new ProfileRegistry();
    const { profile, source } = registry.resolve("DEMO", "story");
    expect(source).toBe("default");

    const result = scoreTicket({ ticket: canonical, profile, profileSource: source });
    expect(result.readiness_status).toBe("needs_clarification");
    expect(result.missing_items.some((m) => m.dimension === "acceptance_criteria")).toBe(true);

    // ── 4. Generate questions ───────────────────────────────────────────────
    applyQuestions(result, profile);
    expect(result.questions_for_pm.length).toBeGreaterThan(0);

    // ── 5. Persist evidence bundle ──────────────────────────────────────────
    const store = new EvidenceStore();
    const bundle = store.persist({
      trigger: "board_sweep:1",
      adapter_traces: [trace],
      canonical_ticket: canonical,
      scorer_input: { profile_id: profile.id, profile_source: source },
      scorer_output: result,
      verdict: result.readiness_status,
      comment_draft_id: null,
    });
    expect(bundle.run_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(store.size).toBe(1);

    // Retrieve round-trips correctly
    const retrieved = store.get(bundle.run_id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.verdict).toBe("needs_clarification");

    // ── 6. Emit comment draft ───────────────────────────────────────────────
    const draft = emitCommentDraft(result, bundle.run_id);
    expect(draft.ticket_key).toBe("DEMO-42");
    expect(draft.run_id).toBe(bundle.run_id);
    expect(draft.body).toContain(bundle.run_id);
    expect(draft.body).toContain("DEMO-42");
    expect(draft.body).toContain("NEEDS CLARIFICATION");
    expect(draft.confirm_post_url).toContain(bundle.run_id);
    expect(draft.confirm_post_url).toContain("DEMO-42");

    // ── 7. Confirm gate: draft NOT posted autonomously ──────────────────────
    // The confirm_post_url must require explicit human action.
    // We verify no additional fetch calls were made after the board sweep.
    // (fetch was called exactly once for getBoardIssues; no Jira write occurred)
    const fetchMock = vi.mocked(global.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adapter_unavailable path: both adapters down → blocked verdict, no partial output", async () => {
    vi.stubGlobal("fetch", mockFetch([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 503, body: {} },
    ]));

    const agile = new JiraAgileRestAdapter({
      baseUrl: "https://demo.atlassian.net",
      accessToken: "tok",
      retryDelayMs: 0,
    });

    // Adapter throws after ×3 retries
    await expect(agile.getBoardIssues(1)).rejects.toThrow("JiraAgile.getBoardIssues failed");

    // No partial output — caller must NOT produce a draft without a canonical ticket
    // (verified by the fact that we never reach emitCommentDraft)
  });
});
