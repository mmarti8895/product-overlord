/**
 * Integration tests — SprintMonitor full poll cycle (task 5.5)
 *
 * Verifies:
 *   - Happy path: snapshot cached and event emitted
 *   - 5xx error: previous snapshot marked stale
 *   - No active sprint: cache not set
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SprintMonitor } from "../../../services/sprint-monitor.js";
import { AgentEventBus } from "../../../agents/AgentEventBus.js";
import type { JiraAgileRestAdapter } from "../../../adapters/jira-agile-rest.js";

const SPRINT_CFG = {
  pollIntervalMs: 999_999,
  doneStatuses: ["Done"],
  boardIds: ["42"],
};

const SPRINT_WINDOW = {
  startDate: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
};

function makeHappyJira(): JiraAgileRestAdapter {
  return {
    listSprints: vi.fn().mockResolvedValue({
      sprints: [{ id: 10, name: "Sprint 42", state: "active", ...SPRINT_WINDOW }],
      trace: {},
    }),
    getSprintIssues: vi.fn().mockResolvedValue({
      issues: [
        { key: "P-1", fields: { story_points: 5, status: { name: "Done" }, created: SPRINT_WINDOW.startDate, issuelinks: [] } },
        { key: "P-2", fields: { story_points: 3, status: { name: "In Progress" }, created: SPRINT_WINDOW.startDate, issuelinks: [] } },
      ],
      trace: {},
    }),
  } as unknown as JiraAgileRestAdapter;
}

describe("SprintMonitor integration", () => {
  let events: unknown[] = [];
  let unsub: () => void;

  beforeEach(() => {
    events = [];
    unsub = AgentEventBus.subscribe(e => events.push(e));
  });

  afterEach(() => {
    unsub();
  });

  it("happy path: caches snapshot and emits finding event", async () => {
    const jira = makeHappyJira();
    const monitor = new SprintMonitor(jira, SPRINT_CFG);
    // Override velocity to avoid extra adapter calls
    (monitor as unknown as { velocity: { getVelocity: () => Promise<[]> } }).velocity.getVelocity = vi.fn().mockResolvedValue([]);

    await monitor._pollBoard("42");

    const snap = monitor.getSnapshot("42");
    expect(snap).toBeDefined();
    expect(snap!.sprint_id).toBe("10");
    expect(snap!.committed_points).toBe(8);
    expect(snap!.completed_points).toBe(5);
    expect(snap!.stale).toBe(false);

    const sprintEvents = events.filter(
      (e: unknown) => (e as { event: string; agent: string }).event === "finding" && (e as { agent: string }).agent === "sprint-monitor"
    );
    expect(sprintEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("getAllSnapshots returns all cached boards", async () => {
    const jira = makeHappyJira();
    const monitor = new SprintMonitor(jira, { ...SPRINT_CFG, boardIds: ["42", "43"] });
    (monitor as unknown as { velocity: { getVelocity: () => Promise<[]> } }).velocity.getVelocity = vi.fn().mockResolvedValue([]);

    await monitor._pollBoard("42");
    await monitor._pollBoard("43");

    expect(monitor.getAllSnapshots()).toHaveLength(2);
  });

  it("5xx error: marks existing snapshot stale", async () => {
    const jira = makeHappyJira();
    const monitor = new SprintMonitor(jira, SPRINT_CFG);
    (monitor as unknown as { velocity: { getVelocity: () => Promise<[]> } }).velocity.getVelocity = vi.fn().mockResolvedValue([]);

    // First poll succeeds
    await monitor._pollBoard("42");
    expect(monitor.getSnapshot("42")!.stale).toBe(false);

    // Second poll fails
    (jira.listSprints as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("HTTP 503"));
    await monitor._pollBoard("42");

    const snap = monitor.getSnapshot("42");
    expect(snap!.stale).toBe(true);
    expect(snap!.stale_since).toBeDefined();
  });

  it("no active sprint: snapshot not set", async () => {
    const jira: JiraAgileRestAdapter = {
      listSprints: vi.fn().mockResolvedValue({ sprints: [], trace: {} }),
      getSprintIssues: vi.fn(),
    } as unknown as JiraAgileRestAdapter;

    const monitor = new SprintMonitor(jira, SPRINT_CFG);
    await monitor._pollBoard("42");

    expect(monitor.getSnapshot("42")).toBeUndefined();
  });
});
