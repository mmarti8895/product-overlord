/**
 * Unit tests — Reviewer agent (task 3.7)
 *
 * Covers:
 *   - permission violation: component not in allowedComponents → blocked
 *   - insufficient evidence: score below threshold without conflict → blocked
 *   - conflict surfaced: conflict present → still approved if other rules pass
 *   - branch key missing → blocked
 *   - invalid slug → blocked
 *   - clean approval path
 */
import { describe, it, expect } from "vitest";
import { reviewActionPackage } from "../../planning/reviewer.js";
// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------
function makePackage(overrides = {}) {
    return {
        ticket_key: "ABC-123",
        readiness_status: "ready",
        readiness_score: 80,
        candidate_components: [{ name: "auth", confidence: 0.85, why: "semantic match" }],
        candidate_files: [{ path: "src/auth/index.ts", reason: "root path" }],
        candidate_tests: [{ path: "src/auth/__tests__", reason: "test dir" }],
        branch_name_suggestion: "abc-123-add-oauth-login",
        openspec_change_slug: "abc-123-add-oauth-login",
        operational_risks: [],
        manual_checks: [],
        repo_map_confidence: 0.85,
        low_confidence: false,
        conflict: null,
        evidence: ["readiness:ready", "component:auth"],
        ...overrides,
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Reviewer — approval", () => {
    it("approves a clean, fully-specified action package", () => {
        const verdict = reviewActionPackage(makePackage());
        expect(verdict.approved).toBe(true);
        expect(verdict.reasons).toHaveLength(0);
    });
});
describe("Reviewer — permission violation", () => {
    it("blocks when candidate component is not in allowedComponents", () => {
        const verdict = reviewActionPackage(makePackage(), {
            allowedComponents: new Set(["payments"]), // 'auth' is NOT allowed
        });
        expect(verdict.approved).toBe(false);
        expect(verdict.reasons.some((r) => r.includes("auth"))).toBe(true);
        expect(verdict.reasons.some((r) => r.includes("permission"))).toBe(true);
    });
    it("passes when all components are in allowedComponents", () => {
        const verdict = reviewActionPackage(makePackage(), {
            allowedComponents: new Set(["auth"]),
        });
        expect(verdict.approved).toBe(true);
    });
});
describe("Reviewer — insufficient evidence", () => {
    it("blocks when readiness_score < minScore and no conflict explanation", () => {
        const verdict = reviewActionPackage(makePackage({ readiness_score: 30, conflict: null }), { minReadinessScore: 50 });
        expect(verdict.approved).toBe(false);
        expect(verdict.reasons.some((r) => r.includes("below minimum"))).toBe(true);
    });
    it("passes when conflict is present (provides explanation) even if score is low", () => {
        const verdict = reviewActionPackage(makePackage({
            readiness_score: 30,
            conflict: {
                reason: "low repo confidence",
                readiness_status: "ready",
                repo_map_confidence: 0.1,
            },
        }), { minReadinessScore: 50 });
        expect(verdict.approved).toBe(true);
    });
});
describe("Reviewer — branch key", () => {
    it("blocks when branch_name_suggestion does not contain ticket key", () => {
        const verdict = reviewActionPackage(makePackage({ branch_name_suggestion: "feature-add-oauth" }) // missing 'abc-123'
        );
        expect(verdict.approved).toBe(false);
        expect(verdict.reasons.some((r) => r.includes("branch_name_suggestion"))).toBe(true);
    });
});
describe("Reviewer — slug validation", () => {
    it("blocks when openspec_change_slug contains uppercase", () => {
        const verdict = reviewActionPackage(makePackage({ openspec_change_slug: "ABC-123-oauth" }));
        expect(verdict.approved).toBe(false);
        expect(verdict.reasons.some((r) => r.includes("openspec_change_slug"))).toBe(true);
    });
    it("blocks when openspec_change_slug is empty", () => {
        const verdict = reviewActionPackage(makePackage({ openspec_change_slug: "" }));
        expect(verdict.approved).toBe(false);
    });
});
describe("Reviewer — required fields", () => {
    it("blocks when ticket_key is missing", () => {
        const verdict = reviewActionPackage(makePackage({ ticket_key: "" }));
        expect(verdict.approved).toBe(false);
        expect(verdict.reasons.some((r) => r.includes("ticket_key"))).toBe(true);
    });
    it("blocks when branch_name_suggestion is missing", () => {
        const verdict = reviewActionPackage(makePackage({ branch_name_suggestion: "" }));
        expect(verdict.approved).toBe(false);
    });
});
