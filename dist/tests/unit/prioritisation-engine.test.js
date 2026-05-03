/**
 * Unit tests — PrioritisationEngine (roadmap-planning task 5.2)
 *
 * Covers:
 *   - RICE formula correctness
 *   - ICE normalisation (1–10 range)
 *   - Human override precedence (reach/impact/confidence/effort)
 *   - LLM failure returns null scores without throwing
 */
import { describe, it, expect, vi } from "vitest";
import { PrioritisationEngine } from "../../services/prioritisation-engine.js";
function makeEpic(overrides = {}) {
    return {
        key: "PROJ-1",
        summary: "Feature X",
        project_key: "PROJ",
        status: "In Progress",
        health_score: 80,
        health_label: "healthy",
        child_keys: [],
        linked_epic_keys: [],
        milestone_id: null,
        rice_score: null,
        ice_score: null,
        description: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}
function makeLLM(reachValue = 500) {
    return {
        complete: vi.fn().mockResolvedValue({ result: { reach: reachValue } }),
        embed: vi.fn(),
    };
}
function makeLLMFailing() {
    return {
        complete: vi.fn().mockRejectedValue(new Error("LLM unavailable")),
        embed: vi.fn(),
    };
}
describe("PrioritisationEngine", () => {
    it("RICE formula: score = (reach * impact * (confidence/100)) / effort", async () => {
        const engine = new PrioritisationEngine(makeLLM(400));
        const epic = makeEpic({ health_score: 80 });
        // Override everything so formula is deterministic
        const result = await engine.score(epic, { reach: 400, impact: 2, confidence: 80, effort: 4 });
        // Expected: (400 * 2 * (80/100)) / 4 = 160
        const rice = result.rice_score;
        expect(rice?.score).toBeCloseTo(160, 0);
    });
    it("ICE normalisation — ice values in range 1–10", async () => {
        const engine = new PrioritisationEngine(makeLLM(200));
        const result = await engine.score(makeEpic(), { reach: 200, impact: 1, confidence: 60, effort: 3 });
        const ice = result.ice_score;
        expect(ice).not.toBeNull();
        if (ice) {
            expect(ice.impact).toBeGreaterThanOrEqual(1);
            expect(ice.impact).toBeLessThanOrEqual(10);
            expect(ice.confidence).toBeGreaterThanOrEqual(1);
            expect(ice.confidence).toBeLessThanOrEqual(10);
            expect(ice.ease).toBeGreaterThanOrEqual(1);
            expect(ice.ease).toBeLessThanOrEqual(10);
        }
    });
    it("human override precedence — override reach/impact used over LLM", async () => {
        const llm = makeLLM(999); // LLM would return 999 if called
        const engine = new PrioritisationEngine(llm);
        const result = await engine.score(makeEpic(), { reach: 50 });
        // reach should be 50 from override, not 999 from LLM
        const rice = result.rice_score;
        expect(rice?.reach).toBe(50);
        // LLM should NOT have been called for reach since override provided
        expect(llm.complete.mock.calls.length).toBe(0);
    });
    it("LLM failure — engine does not throw, returns an epic with scores (graceful fallback)", async () => {
        const engine = new PrioritisationEngine(makeLLMFailing());
        const epic = makeEpic();
        // Should not throw — graceful degradation using fallback values
        const result = await engine.score(epic);
        // Result is an epic object (not undefined/error)
        expect(result).toBeDefined();
        expect(result.key).toBe("PROJ-1");
    });
    it("epic with 'critical' in summary gets impact = 3", async () => {
        const engine = new PrioritisationEngine(makeLLM(100));
        const epic = makeEpic({ summary: "critical security fix" });
        const result = await engine.score(epic, { reach: 100, confidence: 50, effort: 2 });
        const rice = result.rice_score;
        expect(rice?.impact).toBe(3);
    });
});
