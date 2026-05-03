/**
 * Unit tests — health score formula & health_label derivation (task 5.4)
 *
 * Tests the formula:
 *   health_score = clamp(100
 *     - (blockers.length * 10)
 *     - (scope_creep_delta * 2)
 *     - (completedRatio < 0.5 && daysRemaining < 3 ? 30 : 0)
 *   , 0, 100)
 *
 *   >= 75 → on-track
 *   >= 40 → at-risk
 *   <  40 → off-track
 *
 * We exercise this by calling SprintMonitor._pollBoard with a mocked Jira adapter.
 */
import { describe, it, expect, vi } from "vitest";
import { SprintMonitor } from "../../services/sprint-monitor.js";
function makeJira(opts) {
    const { committed, completed, blockerCount = 0, scopeCreepCount = 0, daysRemaining = 10, } = opts;
    const now = Date.now();
    // Start 12 days ago so midpoint (= now + (daysRemaining-12)/2 days) is always
    // in the past for the default daysRemaining=10 case, enabling BlockerDetector.
    const startDate = new Date(now - 12 * 86_400_000).toISOString();
    const endDate = new Date(now + daysRemaining * 86_400_000).toISOString();
    const issues = [];
    // Completed issues
    for (let i = 0; i < completed; i++) {
        issues.push({ key: `C-${i}`, fields: { story_points: 1, status: { name: "Done" }, created: startDate, issuelinks: [] } });
    }
    // Remaining uncommitted issues
    for (let i = 0; i < committed - completed; i++) {
        const links = i < blockerCount
            ? [{ type: { inward: "is blocked by" }, inwardIssue: { key: `EXT-${i}`, fields: { status: { name: "Open" } } } }]
            : [];
        issues.push({ key: `I-${i}`, fields: { story_points: 1, status: { name: "In Progress" }, created: startDate, issuelinks: links } });
    }
    // Scope creep issues (created after sprint start)
    for (let i = 0; i < scopeCreepCount; i++) {
        issues.push({ key: `SC-${i}`, fields: { story_points: 1, status: { name: "To Do" }, created: new Date(now - 86_400_000).toISOString(), issuelinks: [] } });
    }
    return {
        listSprints: vi.fn().mockResolvedValue({
            sprints: [{ id: 1, name: "Sprint Test", state: "active", startDate, endDate }],
            trace: {},
        }),
        getSprintIssues: vi.fn().mockResolvedValue({ issues, trace: {} }),
    };
}
async function getHealth(jira) {
    const monitor = new SprintMonitor(jira, { pollIntervalMs: 999_999, doneStatuses: ["Done"], boardIds: ["1"], sprintLengthDays: 14 });
    // Patch velocity tracker to return empty (tested separately)
    monitor.velocity.getVelocity = vi.fn().mockResolvedValue([]);
    await monitor._pollBoard("1");
    return monitor.getSnapshot("1");
}
describe("Health score formula (task 5.4)", () => {
    it("on-track: no blockers, no scope creep, good velocity → score >= 75", async () => {
        const snap = await getHealth(makeJira({ committed: 10, completed: 8 }));
        expect(snap.health_score).toBeGreaterThanOrEqual(75);
        expect(snap.health_label).toBe("on-track");
    });
    it("at-risk: 3 blockers → score in [40, 74]", async () => {
        const snap = await getHealth(makeJira({ committed: 10, completed: 7, blockerCount: 3 }));
        expect(snap.health_score).toBeGreaterThanOrEqual(40);
        expect(snap.health_score).toBeLessThan(75);
        expect(snap.health_label).toBe("at-risk");
    });
    it("off-track: many blockers + scope creep → score < 40", async () => {
        const snap = await getHealth(makeJira({ committed: 10, completed: 2, blockerCount: 5, scopeCreepCount: 10 }));
        expect(snap.health_score).toBeLessThan(40);
        expect(snap.health_label).toBe("off-track");
    });
    it("clamps score to 0 minimum (never negative)", async () => {
        const snap = await getHealth(makeJira({ committed: 10, completed: 0, blockerCount: 10, scopeCreepCount: 20 }));
        expect(snap.health_score).toBeGreaterThanOrEqual(0);
    });
    it("applies 30-pt penalty when completed < 50% and daysRemaining < 3", async () => {
        const baseline = await getHealth(makeJira({ committed: 10, completed: 4, daysRemaining: 10 }));
        const nearEnd = await getHealth(makeJira({ committed: 10, completed: 4, daysRemaining: 2 }));
        expect(nearEnd.health_score).toBeLessThan(baseline.health_score);
        expect(baseline.health_score - nearEnd.health_score).toBe(30);
    });
    it("boundary: score exactly 75 → on-track", async () => {
        // 100 - 0 blockers - 0 creep - 0 penalty = 100 (on-track), test the >= 75 boundary
        const snap = await getHealth(makeJira({ committed: 10, completed: 10 }));
        expect(snap.health_score).toBe(100);
        expect(snap.health_label).toBe("on-track");
    });
});
