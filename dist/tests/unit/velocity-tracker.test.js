import { describe, it, expect, vi, beforeEach } from "vitest";
import { VelocityTracker } from "../../services/velocity-tracker.js";
const DONE = ["Done", "Closed"];
function makeIssue(sp, status) {
    return { key: `P-${Math.random().toString(36).slice(2)}`, fields: { story_points: sp, status: { name: status } } };
}
describe("VelocityTracker", () => {
    describe("Fixture A — 6 closed sprints", () => {
        let tracker;
        const sprintDefs = Array.from({ length: 6 }, (_, i) => ({ id: 6 - i, name: `Sprint ${6 - i}`, state: "closed" }));
        beforeEach(() => {
            const jira = {
                listSprints: vi.fn().mockResolvedValue({ sprints: sprintDefs, trace: {} }),
                getSprintIssues: vi.fn().mockImplementation(async (id) => ({
                    issues: [makeIssue(5, "Done"), makeIssue(3, id % 2 === 0 ? "In Progress" : "Done")],
                    trace: {},
                })),
            };
            tracker = new VelocityTracker(jira, DONE);
        });
        it("returns 6 VelocityPoints", async () => {
            const pts = await tracker.getVelocity(1, 6);
            expect(pts).toHaveLength(6);
        });
        it("returns oldest → newest order", async () => {
            const pts = await tracker.getVelocity(1, 6);
            expect(pts[0].sprint_name).toBe("Sprint 1");
            expect(pts[5].sprint_name).toBe("Sprint 6");
        });
        it("committed >= completed for all points", async () => {
            const pts = await tracker.getVelocity(1, 6);
            for (const p of pts)
                expect(p.committed).toBeGreaterThanOrEqual(p.completed);
        });
    });
    describe("Fixture B — 2 closed sprints", () => {
        it("returns exactly 2 VelocityPoints", async () => {
            const jira = {
                listSprints: vi.fn().mockResolvedValue({ sprints: [{ id: 1, name: "S1", state: "closed" }, { id: 2, name: "S2", state: "closed" }], trace: {} }),
                getSprintIssues: vi.fn().mockResolvedValue({ issues: [makeIssue(5, "Done"), makeIssue(5, "In Progress")], trace: {} }),
            };
            const pts = await new VelocityTracker(jira, DONE).getVelocity(1, 6);
            expect(pts).toHaveLength(2);
        });
    });
    describe("Fixture C — 0 closed sprints", () => {
        it("returns an empty array", async () => {
            const jira = {
                listSprints: vi.fn().mockResolvedValue({ sprints: [], trace: {} }),
                getSprintIssues: vi.fn(),
            };
            const pts = await new VelocityTracker(jira, DONE).getVelocity(1, 6);
            expect(pts).toEqual([]);
        });
    });
    describe("story_points → original_estimate fallback", () => {
        it("converts timeoriginalestimate seconds to points (div 8h)", async () => {
            const jira = {
                listSprints: vi.fn().mockResolvedValue({ sprints: [{ id: 1, name: "S1", state: "closed" }], trace: {} }),
                getSprintIssues: vi.fn().mockResolvedValue({
                    issues: [
                        { key: "P-1", fields: { timeoriginalestimate: 28800, status: { name: "Done" } } },
                        { key: "P-2", fields: { timeoriginalestimate: 57600, status: { name: "In Progress" } } },
                    ],
                    trace: {},
                }),
            };
            const pts = await new VelocityTracker(jira, DONE).getVelocity(1, 6);
            expect(pts[0].committed).toBe(3);
            expect(pts[0].completed).toBe(1);
        });
    });
});
