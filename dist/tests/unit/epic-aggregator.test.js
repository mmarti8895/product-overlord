/**
 * Unit tests — EpicAggregator (roadmap-planning tasks 5.1, 5.4)
 *
 * Covers:
 *   - Healthy board: children with high readiness → healthy label
 *   - At-risk board: children with mid readiness → at-risk label
 *   - No child tickets: warning emitted, health defaults to 50
 *   - Health label boundaries: 70 → healthy, 40 → at-risk, <40 → blocked
 */
import { describe, it, expect, vi } from "vitest";
import { EpicAggregator } from "../../services/epic-aggregator.js";
function makeJira(epics) {
    return {
        getEpicsForBoard: vi.fn().mockResolvedValue({ epics }),
    };
}
function makeTicket(overrides = {}) {
    return {
        key: "PROJ-1",
        summary: "A ticket",
        status: "To Do",
        issue_type: "Story",
        priority: "Medium",
        labels: [],
        components: [],
        sprint_id: null,
        sprint_name: null,
        assignee: null,
        reporter: null,
        story_points: null,
        original_estimate_hours: null,
        time_spent_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: null,
        description: null,
        acceptance_criteria: null,
        dependencies: [],
        parent: null,
        project_key: "PROJ",
        source: "jira",
        epic_key: null,
        fix_versions: [],
        ...overrides,
        // readiness_score is not on canonical type but aggregator casts it
    };
}
function makeAggregator(epics, childMap) {
    const jira = makeJira(epics);
    return new EpicAggregator({
        jira,
        loadChildTickets: vi.fn().mockImplementation(async (epicKey) => childMap[epicKey] ?? []),
    });
}
describe("EpicAggregator", () => {
    // ── Healthy board ──────────────────────────────────────────────────────
    it("healthy board — high readiness children produce healthy label", async () => {
        const agg = makeAggregator([{ key: "PROJ-100", summary: "Epic A" }], {
            "PROJ-100": [
                makeTicket({ readiness_score: 0.9 }),
                makeTicket({ readiness_score: 0.85 }),
            ],
        });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.epics[0].health_label).toBe("healthy");
        expect(snap.epics[0].health_score).toBeGreaterThanOrEqual(70);
    });
    // ── At-risk board ──────────────────────────────────────────────────────
    it("at-risk board — mid readiness children produce at-risk label", async () => {
        const agg = makeAggregator([{ key: "PROJ-200", summary: "Epic B" }], {
            "PROJ-200": [
                makeTicket({ readiness_score: 0.55 }),
                makeTicket({ readiness_score: 0.45 }),
            ],
        });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.epics[0].health_label).toBe("at-risk");
    });
    // ── No child tickets ───────────────────────────────────────────────────
    it("no child tickets — emits warning and health defaults to 50", async () => {
        const agg = makeAggregator([{ key: "PROJ-300", summary: "Epic C" }], { "PROJ-300": [] });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.warnings.some(w => w.includes("no_child_tickets"))).toBe(true);
        expect(snap.epics[0].health_score).toBe(50);
    });
    // ── Label boundaries ───────────────────────────────────────────────────
    it("health_score 70 → healthy", async () => {
        const agg = makeAggregator([{ key: "PROJ-400", summary: "Epic D" }], { "PROJ-400": [makeTicket({ readiness_score: 0.70 })] });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.epics[0].health_label).toBe("healthy");
    });
    it("health_score 40 → at-risk", async () => {
        const agg = makeAggregator([{ key: "PROJ-500", summary: "Epic E" }], { "PROJ-500": [makeTicket({ readiness_score: 0.40 })] });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.epics[0].health_label).toBe("at-risk");
    });
    it("health_score < 40 → blocked", async () => {
        const agg = makeAggregator([{ key: "PROJ-600", summary: "Epic F" }], { "PROJ-600": [makeTicket({ readiness_score: 0.20 })] });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.epics[0].health_label).toBe("blocked");
    });
    // ── No epics ───────────────────────────────────────────────────────────
    it("board with no epics — returns empty epics + warning", async () => {
        const agg = makeAggregator([], {});
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.epics).toHaveLength(0);
        expect(snap.warnings).toContain("no_epics_found");
    });
    // ── Milestones from child fix_versions ─────────────────────────────────
    it("maps child ticket fix_versions to milestones", async () => {
        const childWithVersion = makeTicket({ fix_versions: ["v1.0", "v2.0"], epic_key: "PROJ-700" });
        const agg = makeAggregator([{ key: "PROJ-700", summary: "Epic G" }], { "PROJ-700": [childWithVersion] });
        const snap = await agg.aggregate(1, "PROJ");
        expect(snap.milestones.length).toBeGreaterThanOrEqual(1);
        expect(snap.milestones.some(m => m.name === "v1.0")).toBe(true);
    });
});
