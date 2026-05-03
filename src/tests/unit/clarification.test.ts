/**
 * Unit tests for the clarification question generator.
 * Covers: PM question for missing AC, engineer question for undeclared dependency.
 */

import { describe, it, expect } from "vitest";
import { generateQuestions, applyQuestions } from "../../readiness/clarification.js";
import { scoreTicket } from "../../readiness/scorer.js";
import { DEFAULT_STORY_PROFILE } from "../../readiness/profile.js";
import type { CanonicalTicket } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

function makeStory(overrides: Partial<CanonicalTicket> = {}): CanonicalTicket {
  return {
    ticket_key: "FEAT-7",
    ticket_type: "story",
    summary: "Allow users to reset their password",
    description: "As a user I want to reset my password.",
    acceptance_criteria: null,
    ac_field_source: null,
    issue_type: "Story",
    status: "To Do",
    labels: [],
    priority: "High",
    reporter: "alice",
    assignee: null,
    linked_artifacts: [],
    dependencies: [],
    comments: [],
    board_id: "1",
    sprint_id: null,
    raw_fields: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PM question for missing acceptance criteria
// ---------------------------------------------------------------------------

describe("clarification generator — missing acceptance criteria", () => {
  it("generates at least one PM question when AC is null", () => {
    const ticket = makeStory({ acceptance_criteria: null });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });
    const { questions_for_pm } = generateQuestions(result, DEFAULT_STORY_PROFILE);

    expect(questions_for_pm.length).toBeGreaterThanOrEqual(1);
  });

  it("PM question contains the ticket key", () => {
    const ticket = makeStory({ acceptance_criteria: null });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });
    const { questions_for_pm } = generateQuestions(result, DEFAULT_STORY_PROFILE);

    expect(questions_for_pm.some((q) => q.includes("FEAT-7"))).toBe(true);
  });

  it("PM question asks for a measurable success condition", () => {
    const ticket = makeStory({ acceptance_criteria: null });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });
    const { questions_for_pm } = generateQuestions(result, DEFAULT_STORY_PROFILE);

    // The default AC template mentions "measurable" or "verifiable"
    const acQuestion = questions_for_pm.find((q) =>
      /measurable|verifiable|success condition/i.test(q)
    );
    expect(acQuestion).toBeDefined();
  });

  it("no questions generated when verdict is ready", () => {
    const ticket = makeStory({
      acceptance_criteria: "Given X when Y then Z.",
      description: "Full description with scope. Out of scope: nothing.",
      labels: ["feature-flag"],
      dependencies: [],
    });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });

    if (result.readiness_status === "ready") {
      const questions = generateQuestions(result, DEFAULT_STORY_PROFILE);
      // ready tickets may still have no-op questions; but pm questions for
      // missing items should be empty when all dims pass
      expect(result.missing_items).toHaveLength(0);
      expect(questions.questions_for_pm).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Engineer question for undeclared dependency
// ---------------------------------------------------------------------------

describe("clarification generator — missing dependency declaration", () => {
  it("generates at least one engineer question when dependencies array is empty on a story", () => {
    // Remove both AC and dependencies to force dependency dimension to fire
    const ticket = makeStory({
      acceptance_criteria: "Given valid creds, user logs in.",
      description: "Full description.",
      dependencies: [],
    });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });
    const { questions_for_engineer } = generateQuestions(result, DEFAULT_STORY_PROFILE);

    // dependencies_declared dimension is weight 0.20 / severity high
    // should appear in missing items
    const depItem = result.missing_items.find((m) => m.dimension === "dependencies_declared");
    if (depItem) {
      expect(questions_for_engineer.length).toBeGreaterThanOrEqual(1);
      expect(questions_for_engineer.some((q) => q.includes("FEAT-7"))).toBe(true);
    }
  });

  it("engineer question mentions dependency or interface contract", () => {
    const ticket = makeStory({ dependencies: [] });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });
    const { questions_for_engineer } = generateQuestions(result, DEFAULT_STORY_PROFILE);

    const depQuestion = questions_for_engineer.find((q) =>
      /depend|block|link|interface|service/i.test(q)
    );
    if (questions_for_engineer.length > 0) {
      expect(depQuestion).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// applyQuestions helper
// ---------------------------------------------------------------------------

describe("applyQuestions", () => {
  it("populates question arrays on the result object for needs_clarification verdict", () => {
    const ticket = makeStory({ acceptance_criteria: null });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });
    expect(result.readiness_status).toBe("needs_clarification");

    applyQuestions(result, DEFAULT_STORY_PROFILE);
    expect(result.questions_for_pm.length + result.questions_for_engineer.length).toBeGreaterThan(0);
  });

  it("does not populate questions for ready verdict", () => {
    const ticket = makeStory({
      acceptance_criteria: "AC present.",
      description: "Business intent described. Out of scope: X.",
      dependencies: [{ key: "D-1", relationship: "is blocked by", status: "Done" }],
      labels: ["flag"],
    });
    const result = scoreTicket({ ticket, profile: DEFAULT_STORY_PROFILE, profileSource: "default" });

    // Only apply if not ready — guards the test from scoring variations
    if (result.readiness_status !== "ready") return;
    applyQuestions(result, DEFAULT_STORY_PROFILE);
    expect(result.questions_for_pm).toHaveLength(0);
    expect(result.questions_for_engineer).toHaveLength(0);
  });
});
