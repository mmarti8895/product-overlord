/**
 * Unit tests — BlockerDetector (task 5.2)
 *
 * Fixtures:
 *   A) Blocker past midpoint → included
 *   B) Blocker before midpoint → excluded
 *   C) No blockers
 */
import { describe, it, expect } from "vitest";
import { BlockerDetector } from "../../services/blocker-detector.js";
const DONE = ["Done", "Closed"];
// Sprint that started 10 days ago and ends in 4 days (midpoint was 3 days ago)
const PAST_MIDPOINT = {
    startDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    endDate: new Date(Date.now() + 4 * 86_400_000).toISOString(),
};
// Sprint that started yesterday and ends in 13 days (midpoint is in the future)
const BEFORE_MIDPOINT = {
    startDate: new Date(Date.now() - 86_400_000).toISOString(),
    endDate: new Date(Date.now() + 13 * 86_400_000).toISOString(),
};
function makeIssue(key, status, blockedBy = [], blockerStatuses = []) {
    return {
        key,
        fields: {
            summary: `Summary of ${key}`,
            status: { name: status },
            created: new Date(Date.now() - 5 * 86_400_000).toISOString(),
            issuelinks: blockedBy.map((bk, i) => ({
                type: { inward: "is blocked by" },
                inwardIssue: {
                    key: bk,
                    fields: { status: { name: blockerStatuses[i] ?? "In Progress" } },
                },
            })),
        },
    };
}
describe("BlockerDetector", () => {
    const detector = new BlockerDetector(DONE);
    describe("Fixture A — blocked past midpoint", () => {
        it("returns blocker when issue is blocked and sprint is past midpoint", () => {
            const issues = [
                makeIssue("PROJ-1", "In Progress", ["EXT-99"], ["In Progress"]),
                makeIssue("PROJ-2", "In Progress"), // no blockers
            ];
            const result = detector.detect(issues, PAST_MIDPOINT);
            expect(result).toHaveLength(1);
            expect(result[0].key).toBe("PROJ-1");
            expect(result[0].blocker_keys).toContain("EXT-99");
        });
        it("excludes done issues even if they have blocker links", () => {
            const issues = [makeIssue("PROJ-3", "Done", ["EXT-1"])];
            const result = detector.detect(issues, PAST_MIDPOINT);
            expect(result).toHaveLength(0);
        });
        it("excludes blockers that are themselves done", () => {
            const issues = [makeIssue("PROJ-4", "In Progress", ["EXT-2"], ["Done"])];
            const result = detector.detect(issues, PAST_MIDPOINT);
            expect(result).toHaveLength(0);
        });
        it("sorts by age_days descending", () => {
            const issues = [
                { key: "A", fields: { summary: "A", status: { name: "In Progress" }, created: new Date(Date.now() - 2 * 86_400_000).toISOString(), issuelinks: [{ type: { inward: "is blocked by" }, inwardIssue: { key: "X", fields: { status: { name: "Open" } } } }] } },
                { key: "B", fields: { summary: "B", status: { name: "In Progress" }, created: new Date(Date.now() - 8 * 86_400_000).toISOString(), issuelinks: [{ type: { inward: "is blocked by" }, inwardIssue: { key: "Y", fields: { status: { name: "Open" } } } }] } },
            ];
            const result = detector.detect(issues, PAST_MIDPOINT);
            expect(result[0].key).toBe("B"); // older first
        });
    });
    describe("Fixture B — before sprint midpoint", () => {
        it("returns empty array before midpoint regardless of blockers", () => {
            const issues = [makeIssue("PROJ-5", "In Progress", ["EXT-99"])];
            const result = detector.detect(issues, BEFORE_MIDPOINT);
            expect(result).toHaveLength(0);
        });
    });
    describe("Fixture C — no blockers", () => {
        it("returns empty array when no issues have blocker links", () => {
            const issues = [
                makeIssue("PROJ-6", "In Progress"),
                makeIssue("PROJ-7", "To Do"),
            ];
            const result = detector.detect(issues, PAST_MIDPOINT);
            expect(result).toHaveLength(0);
        });
    });
});
