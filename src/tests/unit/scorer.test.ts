/**
 * Unit tests for the readiness scoring engine.
 * Covers: story-ready, story-missing-AC, bug-missing-repro, blocked-by-dependency.
 */

import { describe, it, expect } from "vitest";
import { scoreTicket } from "../../readiness/scorer.js";
import {
  DEFAULT_STORY_PROFILE,
  DEFAULT_BUG_PROFILE,
  ProfileRegistry,
} from "../../readiness/profile.js";
import type { CanonicalTicket } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStory(overrides: Partial<CanonicalTicket> = {}): CanonicalTicket {
  return {
    ticket_key: "ABC-1",
    ticket_type: "story",
    summary: "As a user I can log in",
    description: "We need a login flow so users can authenticate. Out of scope: SSO.",
    acceptance_criteria:
      "Given valid credentials, when user clicks Login, then user sees dashboard.",
    ac_field_source: "Acceptance Criteria",
    issue_type: "Story",
    status: "To Do",
    labels: ["auth", "mvp"],
    priority: "High",
    reporter: "alice",
    assignee: "bob",
    linked_artifacts: [],
    // Engineer has verified deps — one resolved blocker is present
    dependencies: [{ key: "INFRA-1", relationship: "is blocked by", status: "Done" }],
    comments: [],
    board_id: "10",
    sprint_id: "42",
    epic_key: null,
    fix_versions: [],
    raw_fields: {},
    ...overrides,
  };
}

function makeBug(overrides: Partial<CanonicalTicket> = {}): CanonicalTicket {
  return {
    ticket_key: "ABC-2",
    ticket_type: "bug",
    summary: "Login button unresponsive on Safari",
    description:
      "Steps: 1. Open Safari 16. 2. Navigate to /login. 3. Click Login.\n" +
      "Actual: nothing happens.\nExpected: user is redirected to dashboard.\n" +
      "Environment: production, v1.4.2",
    acceptance_criteria: "Login succeeds on Safari 16 with valid credentials.",
    ac_field_source: "Acceptance Criteria",
    issue_type: "Bug",
    status: "Open",
    labels: ["safari", "auth"],
    priority: "Critical",
    reporter: "charlie",
    assignee: "bob",
    linked_artifacts: [{ key: "LOG-123", relationship: "evidence", url: "https://logs/123" }],
    dependencies: [],
    comments: [],
    board_id: "10",
    sprint_id: null,
    epic_key: null,
    fix_versions: [],
    raw_fields: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Story: ready path
// ---------------------------------------------------------------------------

describe("scorer — story ready path", () => {
  it("returns verdict 'ready' with score ≥ 80 when all dimensions are populated", () => {
    const result = scoreTicket({
      ticket: makeStory(),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).toBe("ready");
    expect(result.readiness_score).toBeGreaterThanOrEqual(80);
    expect(result.missing_items).toHaveLength(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("sets ticket_key and ticket_type correctly", () => {
    const result = scoreTicket({
      ticket: makeStory(),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "project",
    });

    expect(result.ticket_key).toBe("ABC-1");
    expect(result.ticket_type).toBe("story");
  });
});

// ---------------------------------------------------------------------------
// Story: missing acceptance criteria
// ---------------------------------------------------------------------------

/**
 * A sparse story: AC null, description empty, no dependencies declared, no labels.
 * Reflects the realistic case the spec targets for "score ≤ 50 when AC missing".
 * Multiple high-weight dimensions (AC=0.30, deps=0.20, scope via description=0.15,
 * rollout via labels+description=0.10) are absent, driving score well below 50.
 */
function makeSparseStory(): CanonicalTicket {
  return makeStory({
    acceptance_criteria: null,
    ac_field_source: null,
    description: "",
    labels: [],
    dependencies: [],
  });
}

describe("scorer — story missing acceptance criteria", () => {
  it("returns 'needs_clarification' when acceptance_criteria is null", () => {
    const result = scoreTicket({
      ticket: makeSparseStory(),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).toBe("needs_clarification");
  });

  it("includes a high-severity missing item for acceptance_criteria", () => {
    const result = scoreTicket({
      ticket: makeSparseStory(),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    const acItem = result.missing_items.find((m) => m.dimension === "acceptance_criteria");
    expect(acItem).toBeDefined();
    expect(acItem!.severity).toBe("high");
  });

  it("score is ≤ 50 when AC and other key dimensions are absent", () => {
    const result = scoreTicket({
      ticket: makeSparseStory(),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    // AC(0.30) + deps(0.20) + scope_boundaries via empty desc(0.15)
    // + rollout_constraints via empty desc+labels(0.10) all missing → score ≤ 25
    expect(result.readiness_score).toBeLessThanOrEqual(50);
    expect(result.explanation).toContain("ABC-1");
  });

  it("score is lower than a fully populated story when only AC is missing", () => {
    const fullMinusAc = scoreTicket({
      ticket: makeStory({ acceptance_criteria: null, ac_field_source: null }),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });
    const full = scoreTicket({
      ticket: makeStory(),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(fullMinusAc.readiness_score).toBeLessThan(full.readiness_score);
    expect(fullMinusAc.readiness_status).toBe("needs_clarification");
  });
});

// ---------------------------------------------------------------------------
// Bug: missing repro steps
// ---------------------------------------------------------------------------

describe("scorer — bug missing repro steps", () => {
  it("returns 'needs_clarification' when description (repro_steps field) is empty", () => {
    const result = scoreTicket({
      ticket: makeBug({ description: "" }),
      profile: DEFAULT_BUG_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).toBe("needs_clarification");
    const reproItem = result.missing_items.find((m) => m.dimension === "repro_steps");
    expect(reproItem).toBeDefined();
    expect(reproItem!.severity).toBe("high");
  });

  it("bug with all fields populated scores ≥ 80 and is ready", () => {
    const result = scoreTicket({
      ticket: makeBug(),
      profile: DEFAULT_BUG_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).toBe("ready");
    expect(result.readiness_score).toBeGreaterThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// Blocked-by-dependency
// ---------------------------------------------------------------------------

describe("scorer — blocked by open dependency", () => {
  it("returns verdict 'blocked' when a dependency has status 'To Do'", () => {
    const result = scoreTicket({
      ticket: makeStory({
        dependencies: [{ key: "DEP-99", relationship: "is blocked by", status: "To Do" }],
      }),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).toBe("blocked");
    expect(result.explanation).toContain("DEP-99");
  });

  it("returns verdict 'blocked' when a dependency has status 'Open'", () => {
    const result = scoreTicket({
      ticket: makeStory({
        dependencies: [{ key: "DEP-55", relationship: "is blocked by", status: "Open" }],
      }),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).toBe("blocked");
  });

  it("does NOT block when dependency status is 'Done'", () => {
    const result = scoreTicket({
      ticket: makeStory({
        dependencies: [{ key: "DEP-1", relationship: "is blocked by", status: "Done" }],
      }),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).not.toBe("blocked");
  });

  it("does NOT block when dependency has no status field", () => {
    const result = scoreTicket({
      ticket: makeStory({
        dependencies: [{ key: "DEP-2", relationship: "depends on" }],
      }),
      profile: DEFAULT_STORY_PROFILE,
      profileSource: "default",
    });

    expect(result.readiness_status).not.toBe("blocked");
  });
});

// ---------------------------------------------------------------------------
// ProfileRegistry
// ---------------------------------------------------------------------------

describe("ProfileRegistry", () => {
  it("resolves default story profile when no project override exists", () => {
    const registry = new ProfileRegistry();
    const { profile, source } = registry.resolve("MYPROJ", "story");
    expect(profile.id).toBe("default:story");
    expect(source).toBe("default");
  });

  it("resolves project-specific profile when registered", () => {
    const registry = new ProfileRegistry();
    registry.register({
      ...DEFAULT_STORY_PROFILE,
      id: "MYPROJ:story",
      name: "My Project Story",
      projectKey: "MYPROJ",
    });
    const { profile, source } = registry.resolve("MYPROJ", "story");
    expect(profile.id).toBe("MYPROJ:story");
    expect(source).toBe("project");
  });

  it("falls back to task profile for unknown issue type", () => {
    const registry = new ProfileRegistry();
    const { profile, source } = registry.resolve("X", "epic");
    expect(profile.id).toBe("default:task");
    expect(source).toBe("default");
  });
});
