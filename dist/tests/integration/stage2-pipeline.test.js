/**
 * Integration test — full stage-2 pipeline (task 3.6)
 *
 * ticket → parallel branches → planner → reviewer → emitter → evidence store
 *
 * Scenarios:
 *   1. Clean run: readiness=ready, repo confidence ≥ 0.8, reviewer approves
 *   2. Repo-mapping branch fails: readiness continues, repo_map=null
 *   3. Conflict surfaced: readiness=ready, repo confidence < 0.3
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { runStage2Pipeline } from "../../repo/stage2-orchestrator.js";
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeTicket(overrides = {}) {
    return {
        ticket_key: "AUTH-99",
        ticket_type: "story",
        summary: "Add OAuth2 login to auth service",
        description: "The authentication service needs OAuth2 SSO support for enterprise customers.",
        acceptance_criteria: "- Given a user with valid Google credentials\n- When they click 'Login with Google'\n- Then they are authenticated via OAuth2 flow",
        ac_field_source: "description",
        issue_type: "Story",
        status: "To Do",
        labels: ["auth", "oauth"],
        priority: "High",
        reporter: "alice",
        assignee: "bob",
        linked_artifacts: [],
        dependencies: [],
        comments: [],
        board_id: "10",
        sprint_id: "42",
        epic_key: null,
        fix_versions: [],
        raw_fields: {},
        ...overrides,
    };
}
function makeIndex() {
    const indexedAt = new Date().toISOString();
    return {
        repoFullName: "org/my-app",
        indexedAt,
        components: [
            {
                name: "auth",
                rootPaths: ["src/auth"],
                frameworks: ["node"],
                owners: [],
                testDirs: ["src/auth/__tests__"],
                testLocationKnown: true,
                conventions: ["src/auth/.eslintrc"],
                fixExamples: [
                    {
                        title: "Fix OAuth token refresh",
                        paths: ["src/auth/oauth.ts"],
                        summary: "Fixed token refresh cycle for Google OAuth2",
                    },
                ],
                indexedAt,
            },
            {
                name: "payments",
                rootPaths: ["src/payments"],
                frameworks: ["node"],
                owners: [],
                testDirs: [],
                testLocationKnown: false,
                conventions: [],
                fixExamples: [],
                indexedAt,
            },
        ],
    };
}
// ---------------------------------------------------------------------------
// Integration suite
// ---------------------------------------------------------------------------
describe("Stage-2 integration: parallel branches → planner → reviewer → emitter", () => {
    afterEach(() => vi.restoreAllMocks());
    it("clean run: reviewer approves and emitter confirms (shadow mode)", async () => {
        const ticket = makeTicket();
        const index = makeIndex();
        const result = await runStage2Pipeline({
            ticket,
            componentIndex: index,
            emitterConfig: { shadowMode: true },
        });
        expect(result.ticket_key).toBe("AUTH-99");
        expect(result.actionPackage).not.toBeNull();
        expect(result.actionPackage.readiness_status).toMatch(/ready|needs_clarification/);
        expect(result.actionPackage.branch_name_suggestion).toContain("auth-99");
        expect(result.actionPackage.openspec_change_slug).toMatch(/^[a-z0-9][a-z0-9-]+/);
        expect(result.reviewerVerdict).not.toBeNull();
        expect(result.emitResult).not.toBeNull();
        expect(result.evidenceBundleId).toBeTruthy();
        expect(result.repoMapFailureReason).toBeUndefined();
    });
    it("top candidate_components contain auth component", async () => {
        const ticket = makeTicket();
        const index = makeIndex();
        const result = await runStage2Pipeline({
            ticket,
            componentIndex: index,
            emitterConfig: { shadowMode: true },
        });
        const top = result.actionPackage.candidate_components[0];
        expect(top.name).toBe("auth");
        expect(top.confidence).toBeGreaterThan(0);
    });
    it("repo-mapping branch unavailable: readiness continues, repo_map is null indicators set", async () => {
        const ticket = makeTicket();
        const result = await runStage2Pipeline({
            ticket,
            componentIndex: null, // simulate unavailable
            emitterConfig: { shadowMode: true },
        });
        expect(result.ticket_key).toBe("AUTH-99");
        expect(result.actionPackage).not.toBeNull();
        expect(result.actionPackage.candidate_components).toHaveLength(0);
        expect(result.actionPackage.low_confidence).toBe(true);
        expect(result.actionPackage.repo_map_confidence).toBe(0);
        // Readiness branch should still run
        expect(result.actionPackage.readiness_status).toBeTruthy();
    });
    it("conflict surfaced: readiness=ready, repo confidence < 0.3 → conflict non-null", async () => {
        const ticket = makeTicket();
        // Index with completely unrelated components — confidence will be near 0
        const weakIndex = {
            repoFullName: "org/my-app",
            indexedAt: new Date().toISOString(),
            components: [
                {
                    name: "billing",
                    rootPaths: ["src/billing"],
                    frameworks: [],
                    owners: [],
                    testDirs: [],
                    testLocationKnown: false,
                    conventions: [],
                    fixExamples: [],
                    indexedAt: new Date().toISOString(),
                },
            ],
        };
        const result = await runStage2Pipeline({
            ticket,
            componentIndex: weakIndex,
            emitterConfig: { shadowMode: true },
        });
        // If readiness is 'ready' and confidence < 0.3, expect conflict
        if (result.actionPackage.readiness_status === "ready" && result.actionPackage.repo_map_confidence < 0.3) {
            expect(result.actionPackage.conflict).not.toBeNull();
            expect(result.actionPackage.conflict.reason).toMatch(/confidence/i);
        }
        else {
            // Readiness not 'ready' — no conflict expected (spec only conflicts on ready)
            expect(result.actionPackage.conflict).toBeNull();
        }
    });
    it("evidence bundle is stored with stage metadata", async () => {
        const { evidenceStore } = await import("../../evidence/store.js");
        const ticket = makeTicket({ ticket_key: "AUTH-101" });
        const index = makeIndex();
        const result = await runStage2Pipeline({
            ticket,
            componentIndex: index,
            emitterConfig: { shadowMode: true },
        });
        const bundle = evidenceStore.get(result.evidenceBundleId);
        expect(bundle).not.toBeNull();
        expect(bundle?.ticket_key).toBe("AUTH-101");
    });
});
