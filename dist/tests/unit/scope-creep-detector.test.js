/**
 * Unit tests — ScopeCreepDetector (task 5.3)
 *
 * Fixtures:
 *   A) Scope additions present
 *   B) No additions (all issues created before sprint start)
 *   C) Missing / invalid created date (edge case)
 */
import { describe, it, expect } from "vitest";
import { ScopeCreepDetector } from "../../services/scope-creep-detector.js";
const SPRINT_START = new Date(Date.now() - 7 * 86_400_000).toISOString();
function issue(key, created, points) {
    return {
        key,
        fields: {
            summary: `${key} summary`,
            story_points: points,
            created,
        },
    };
}
describe("ScopeCreepDetector", () => {
    const detector = new ScopeCreepDetector();
    describe("Fixture A — additions present", () => {
        it("detects issues created after sprint start", () => {
            const issues = [
                issue("P-1", new Date(Date.now() - 8 * 86_400_000).toISOString(), 3), // before start
                issue("P-2", new Date(Date.now() - 5 * 86_400_000).toISOString(), 2), // after start
                issue("P-3", new Date(Date.now() - 1 * 86_400_000).toISOString(), 5), // after start
            ];
            const { additions, delta } = detector.detect(issues, SPRINT_START);
            expect(additions).toHaveLength(2);
            expect(additions.map(a => a.key)).toContain("P-2");
            expect(additions.map(a => a.key)).toContain("P-3");
            expect(delta).toBe(7);
        });
        it("includes added_at and points on each addition", () => {
            const created = new Date(Date.now() - 3 * 86_400_000).toISOString();
            const issues = [issue("P-4", created, 4)];
            const { additions } = detector.detect(issues, SPRINT_START);
            expect(additions[0].added_at).toBe(created);
            expect(additions[0].points).toBe(4);
        });
    });
    describe("Fixture B — no additions", () => {
        it("returns empty additions and zero delta when all created before start", () => {
            const issues = [
                issue("P-5", new Date(Date.now() - 10 * 86_400_000).toISOString(), 5),
                issue("P-6", new Date(Date.now() - 14 * 86_400_000).toISOString(), 3),
            ];
            const { additions, delta } = detector.detect(issues, SPRINT_START);
            expect(additions).toHaveLength(0);
            expect(delta).toBe(0);
        });
    });
    describe("Fixture C — missing / invalid created date", () => {
        it("skips issues with undefined created date", () => {
            const issues = [issue("P-7", undefined, 5)];
            const { additions } = detector.detect(issues, SPRINT_START);
            expect(additions).toHaveLength(0);
        });
        it("skips issues with non-parseable created date", () => {
            const issues = [issue("P-8", "not-a-date", 5)];
            const { additions } = detector.detect(issues, SPRINT_START);
            expect(additions).toHaveLength(0);
        });
        it("falls back to time-based points when story_points is missing", () => {
            const issues = [{
                    key: "P-9",
                    fields: {
                        summary: "P-9",
                        timeoriginalestimate: 28800, // 8h = 1 pt
                        created: new Date(Date.now() - 3 * 86_400_000).toISOString(),
                    },
                }];
            const { additions, delta } = detector.detect(issues, SPRINT_START);
            expect(additions).toHaveLength(1);
            expect(delta).toBe(1);
        });
    });
});
