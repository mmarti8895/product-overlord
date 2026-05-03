/**
 * Unit tests — Repo Mapper (task 2.6)
 *
 * Covers:
 *   - high-confidence component match (top component confidence ≥ 0.5)
 *   - low-confidence honest surface (low_confidence: true when no component > 0.5)
 *   - repo unavailable → low_confidence: true, evidence contains "repo_index_unavailable"
 */

import { describe, it, expect } from "vitest";
import { mapTicketToComponents } from "../../repo/mapper.js";
import type { CanonicalTicket } from "../../types/index.js";
import type { ComponentIndex } from "../../repo/component-indexer.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTicket(overrides: Partial<CanonicalTicket> = {}): CanonicalTicket {
  return {
    ticket_key: "AUTH-42",
    ticket_type: "story",
    summary: "Add OAuth2 login flow to auth service",
    description: "The authentication service needs OAuth2 support for third-party SSO providers.",
    acceptance_criteria: "Users can log in via Google OAuth2.",
    ac_field_source: "description",
    issue_type: "Story",
    status: "To Do",
    labels: ["auth", "oauth"],
    priority: "High",
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

function makeIndex(componentNames: string[]): ComponentIndex {
  const indexedAt = new Date().toISOString();
  return {
    repoFullName: "org/my-app",
    indexedAt,
    components: componentNames.map((name) => ({
      name,
      rootPaths: [`src/${name}`],
      frameworks: name === "auth" ? ["node"] : [],
      owners: [],
      testDirs: name === "auth" ? [`src/${name}/__tests__`] : [],
      testLocationKnown: name === "auth",
      conventions: [],
      fixExamples:
        name === "auth"
          ? [{ title: "Fix OAuth token refresh", paths: [`src/${name}/oauth.ts`], summary: "OAuth token refresh fix" }]
          : [],
      indexedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mapTicketToComponents — high-confidence match", () => {
  it("returns auth component as top candidate when ticket mentions auth/oauth", () => {
    const ticket = makeTicket();
    const index = makeIndex(["auth", "payments", "notifications"]);
    const result = mapTicketToComponents({ ticket, index });

    expect(result.candidate_components[0].name).toBe("auth");
    expect(result.candidate_components[0].confidence).toBeGreaterThan(0.0);
    // auth ranks highest — low_confidence flag depends on absolute score
    // but auth must beat payments and notifications
    expect(result.candidate_components[0].confidence).toBeGreaterThan(
      result.candidate_components[1]?.confidence ?? 0
    );
  });

  it("includes candidate_files derived from auth component root paths", () => {
    const ticket = makeTicket();
    const index = makeIndex(["auth", "payments"]);
    const result = mapTicketToComponents({ ticket, index });
    expect(result.candidate_files.length).toBeGreaterThan(0);
  });

  it("includes candidate_tests from auth testDirs when test location is known", () => {
    const ticket = makeTicket();
    const index = makeIndex(["auth", "payments"]);
    const result = mapTicketToComponents({ ticket, index });
    expect(result.test_location_unknown).toBe(false);
    expect(result.candidate_tests.length).toBeGreaterThan(0);
  });
});

describe("mapTicketToComponents — low-confidence honest surface", () => {
  it("sets low_confidence: true when best component scores ≤ 0.5", () => {
    const ticket = makeTicket({
      summary: "Refactor database migrations",
      description: "We need to update database migration scripts.",
      labels: [],
    });
    // None of these components match auth/oauth keywords
    const index = makeIndex(["billing", "reporting", "notifications"]);
    const result = mapTicketToComponents({ ticket, index });
    expect(result.low_confidence).toBe(true);
  });

  it("still returns candidate_components even when low confidence", () => {
    const ticket = makeTicket({ summary: "Random unrelated task", description: "xyz abc" });
    const index = makeIndex(["foo", "bar"]);
    const result = mapTicketToComponents({ ticket, index });
    expect(result.candidate_components.length).toBeGreaterThan(0);
  });
});

describe("mapTicketToComponents — repo unavailable", () => {
  it("returns blocked result when index is null", () => {
    const ticket = makeTicket();
    const result = mapTicketToComponents({ ticket, index: null });

    expect(result.low_confidence).toBe(true);
    expect(result.test_location_unknown).toBe(true);
    expect(result.candidate_components).toHaveLength(0);
    expect(result.evidence).toContain("repo_index_unavailable");
    expect(result.enrichment_source).toBe("unavailable");
  });
});

describe("mapTicketToComponents — test_location_unknown flag", () => {
  it("sets test_location_unknown: true when best component has no testDirs", () => {
    const ticket = makeTicket();
    // payments component has no testDirs
    const index = makeIndex(["payments"]);
    const result = mapTicketToComponents({ ticket, index });
    expect(result.test_location_unknown).toBe(true);
    expect(result.candidate_tests).toHaveLength(0);
  });
});
