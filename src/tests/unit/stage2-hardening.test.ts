/**
 * Hardening tests — Stage 2 (tasks 4.1–4.5)
 *
 * 4.1 repo-index unavailable: repo_map indicators null, readiness continues
 * 4.2 Teamwork Graph unavailable: structural index used; enrichment_source: unavailable logged
 * 4.3 one parallel branch fails: other branch continues; failure reason in evidence
 * 4.4 branch_name_suggestion always contains work-item key
 * 4.5 security: no repo data leaks into unauthorised context (permission scope)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { runStage2Pipeline } from "../../repo/stage2-orchestrator.js";
import { reviewActionPackage } from "../../planning/reviewer.js";
import { buildBranchName } from "../../planning/solution-planner.js";
import { mapTicketToComponents } from "../../repo/mapper.js";
import type { CanonicalTicket } from "../../types/index.js";
import type { ComponentIndex } from "../../repo/component-indexer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTicket(key = "PROJ-1", overrides: Partial<CanonicalTicket> = {}): CanonicalTicket {
  return {
    ticket_key: key,
    ticket_type: "story",
    summary: "Add user authentication to login service",
    description: "Login service authentication upgrade.",
    acceptance_criteria: "Users can authenticate successfully.",
    ac_field_source: "description",
    issue_type: "Story",
    status: "To Do",
    labels: [],
    priority: "Medium",
    reporter: "alice",
    assignee: null,
    linked_artifacts: [],
    dependencies: [],
    comments: [],
    board_id: null,
    sprint_id: null,
    raw_fields: {},
    ...overrides,
  };
}

function makeIndex(componentName = "auth"): ComponentIndex {
  return {
    repoFullName: "org/app",
    indexedAt: new Date().toISOString(),
    components: [
      {
        name: componentName,
        rootPaths: [`src/${componentName}`],
        frameworks: [],
        owners: [],
        testDirs: [`src/${componentName}/tests`],
        testLocationKnown: true,
        conventions: [],
        fixExamples: [],
        indexedAt: new Date().toISOString(),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 4.1 — repo-index unavailable
// ---------------------------------------------------------------------------

describe("Hardening 4.1 — repo-index unavailable", () => {
  it("returns low_confidence indicators and readiness result is still present", async () => {
    const result = await runStage2Pipeline({
      ticket: makeTicket(),
      componentIndex: null,
      emitterConfig: { shadowMode: true },
    });

    expect(result.actionPackage).not.toBeNull();
    expect(result.actionPackage!.candidate_components).toHaveLength(0);
    expect(result.actionPackage!.low_confidence).toBe(true);
    expect(result.actionPackage!.repo_map_confidence).toBe(0);
    expect(result.actionPackage!.readiness_status).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4.2 — Teamwork Graph unavailable
// ---------------------------------------------------------------------------

describe("Hardening 4.2 — Teamwork Graph unavailable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mapper uses structural_only when graph is unavailable", () => {
    const ticket = makeTicket();
    const index = makeIndex();

    // mapTicketToComponents never calls TeamworkGraph — it's enrichment-only
    // Repo mapper marks enrichment_source as structural_only by default
    const result = mapTicketToComponents({ ticket, index });
    expect(result.enrichment_source).toBe("structural_only");
  });

  it("when index is null, enrichment_source is unavailable", () => {
    const ticket = makeTicket();
    const result = mapTicketToComponents({ ticket, index: null });
    expect(result.enrichment_source).toBe("unavailable");
  });
});

// ---------------------------------------------------------------------------
// 4.3 — one parallel branch fails
// ---------------------------------------------------------------------------

describe("Hardening 4.3 — one parallel branch fails (repo)", () => {
  it("readiness continues when repo-mapping fails; failure reason in output", async () => {
    // We simulate repo-mapping failure by passing null (same path as exception)
    const result = await runStage2Pipeline({
      ticket: makeTicket("FAIL-5"),
      componentIndex: null,
      emitterConfig: { shadowMode: true },
    });

    expect(result.actionPackage!.readiness_status).toBeTruthy();
    // Evidence should note unavailability
    expect(
      result.actionPackage!.evidence.some((e) =>
        e.includes("unavailable") || e.includes("repo_map")
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4.4 — branch_name_suggestion always contains work-item key
// ---------------------------------------------------------------------------

describe("Hardening 4.4 — branch_name_suggestion contains work-item key", () => {
  it("buildBranchName always prefixes with ticket key", () => {
    expect(buildBranchName("ABC-123", "improve webhook retry")).toMatch(/^abc-123/);
    expect(buildBranchName("PROJ-999", "some feature")).toMatch(/^proj-999/);
    expect(buildBranchName("X-1", "fix bug")).toMatch(/^x-1/);
  });

  it("stage-2 pipeline outputs branch with work-item key", async () => {
    const result = await runStage2Pipeline({
      ticket: makeTicket("WI-77"),
      componentIndex: makeIndex(),
      emitterConfig: { shadowMode: true },
    });

    expect(result.actionPackage!.branch_name_suggestion).toContain("wi-77");
  });

  it("reviewer rejects if branch key is missing (validates rule)", () => {
    const { makePackage } = (() => {
      const base = {
        ticket_key: "ABC-123",
        readiness_status: "ready" as const,
        readiness_score: 80,
        candidate_components: [],
        candidate_files: [],
        candidate_tests: [],
        branch_name_suggestion: "feature-no-key", // missing abc-123
        openspec_change_slug: "abc-123-feature",
        operational_risks: [],
        manual_checks: [],
        repo_map_confidence: 0.9,
        low_confidence: false,
        conflict: null,
        evidence: [],
      };
      return { makePackage: () => base };
    })();

    const verdict = reviewActionPackage(makePackage());
    expect(verdict.approved).toBe(false);
    expect(verdict.reasons.some((r) => r.includes("branch_name_suggestion"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4.5 — Security: repo index is private; no data leaks to unauthorised context
// ---------------------------------------------------------------------------

describe("Hardening 4.5 — Security: permission scope enforcement", () => {
  it("reviewer blocks action package referencing disallowed component", () => {
    const pkg = {
      ticket_key: "SEC-1",
      readiness_status: "ready" as const,
      readiness_score: 75,
      candidate_components: [
        { name: "internal-secrets", confidence: 0.9, why: "matched" },
      ],
      candidate_files: [],
      candidate_tests: [],
      branch_name_suggestion: "sec-1-fix-secrets",
      openspec_change_slug: "sec-1-fix-secrets",
      operational_risks: [],
      manual_checks: [],
      repo_map_confidence: 0.9,
      low_confidence: false,
      conflict: null,
      evidence: [],
    };

    const verdict = reviewActionPackage(pkg, {
      allowedComponents: new Set(["frontend", "api-gateway"]), // internal-secrets NOT allowed
    });

    expect(verdict.approved).toBe(false);
    expect(verdict.reasons.some((r) => r.includes("internal-secrets"))).toBe(true);
  });

  it("empty allowedComponents set blocks all components", () => {
    const pkg = {
      ticket_key: "SEC-2",
      readiness_status: "ready" as const,
      readiness_score: 75,
      candidate_components: [{ name: "any-component", confidence: 0.9, why: "matched" }],
      candidate_files: [],
      candidate_tests: [],
      branch_name_suggestion: "sec-2-any-component",
      openspec_change_slug: "sec-2-any-component",
      operational_risks: [],
      manual_checks: [],
      repo_map_confidence: 0.9,
      low_confidence: false,
      conflict: null,
      evidence: [],
    };

    const verdict = reviewActionPackage(pkg, {
      allowedComponents: new Set(), // nobody is allowed
    });

    expect(verdict.approved).toBe(false);
  });
});
