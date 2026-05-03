/**
 * Unit tests — DependencyGraphBuilder (roadmap-planning task 5.3)
 *
 * Covers:
 *   - cross-team flag (different project keys)
 *   - cycle detection (A → B → A)
 *   - no edges case
 */

import { describe, it, expect } from "vitest";
import { DependencyGraphBuilder } from "../../services/dependency-graph.js";
import type { Epic } from "../../types/roadmap.js";

function makeEpic(key: string, projectKey: string, linked: string[] = []): Epic {
  return {
    key,
    summary: `Epic ${key}`,
    project_key: projectKey,
    status: "In Progress",
    health_score: 80,
    health_label: "healthy",
    child_count: 0,
    child_done_count: 0,
    linked_epic_keys: linked,
    milestones: [],
    rice_score: null,
    ice_score: null,
    estimated_by: "system",
    description: null,
    labels: [],
  };
}

describe("DependencyGraphBuilder", () => {
  it("no linked epics — returns empty edges, no warnings", () => {
    const builder = new DependencyGraphBuilder();
    const { edges, warnings } = builder.build([
      makeEpic("A-1", "A"),
      makeEpic("B-1", "B"),
    ]);
    expect(edges).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("same project link — cross_team: false", () => {
    const builder = new DependencyGraphBuilder();
    const { edges } = builder.build([
      makeEpic("A-1", "PROJ", ["A-2"]),
      makeEpic("A-2", "PROJ"),
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0].cross_team).toBe(false);
    expect(edges[0].from_epic).toBe("A-1");
    expect(edges[0].to_epic).toBe("A-2");
  });

  it("different project keys — cross_team: true", () => {
    const builder = new DependencyGraphBuilder();
    const { edges } = builder.build([
      makeEpic("A-1", "ALPHA", ["B-1"]),
      makeEpic("B-1", "BETA"),
    ]);
    expect(edges[0].cross_team).toBe(true);
  });

  it("cycle A → B → A — detects cycle and adds warning", () => {
    const builder = new DependencyGraphBuilder();
    const { warnings } = builder.build([
      makeEpic("A-1", "PROJ", ["B-1"]),
      makeEpic("B-1", "PROJ", ["A-1"]),
    ]);
    expect(warnings.some(w => w.startsWith("cycle:"))).toBe(true);
  });

  it("link to unknown epic — edge still emitted, cross_team: false (default)", () => {
    const builder = new DependencyGraphBuilder();
    const { edges } = builder.build([
      makeEpic("A-1", "PROJ", ["UNKNOWN-99"]),
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0].cross_team).toBe(false);
  });
});
