import { describe, it, expect, vi } from "vitest";
import { VelocityTracker } from "../../services/velocity-tracker.js";
const DONE = ["Done", "Closed"];
describe("VelocityTracker", () => {
    describe("Fixture C — 0 closed sprints", () => {
        it("returns an empty array", async () => {
            const jira = {
                listSprints: vi.fn().mockResolvedValue({ sprints: [], trace: {} }),
                getSprintIssues: vi.fn(),
            };
            const tracker = new VelocityTracker(jira, DONE);
            const pts = await tracker.getVelocity(1, 6);
            expect(pts).toEqual([]);
        });
    });
});
