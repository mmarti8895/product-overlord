/**
 * Integration tests — Deep-Research Subagent (Task 5.4)
 *
 * 5.4  Verify:
 *   a) rate limit enforcement (30/day)
 *   b) timeout handling — returns status:"timeout", logs to evidence store
 *   c) isolation — research session_id never equals operational session_id
 *   d) no shared state between operational and research subagents
 *   e) all findings tagged source: "deep-research"
 */
import { describe, it, expect, beforeEach } from "vitest";
import { runDeepResearch } from "../../forge/deep-research.js";
import { _resetRateLimits, _getRequestsToday } from "../../forge/subagent.js";
import { evidenceStore } from "../../evidence/store.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const OP_SESSION_ID = "operational-session-abc-123";
function makeJobStub(delayMs = 0) {
    return async (_sessionId) => {
        if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
        return {
            findings: [
                {
                    source: "deep-research",
                    text: "Found relevant API contract in repo",
                    confidence: 0.9,
                    dimension: "acceptance_criteria",
                },
            ],
            enriched_readiness: { score: 85 },
        };
    };
}
beforeEach(() => {
    _resetRateLimits();
});
// ---------------------------------------------------------------------------
// 5.4a — rate limit enforcement
// ---------------------------------------------------------------------------
describe("5.4a – rate limit enforcement", () => {
    it("allows up to 30 requests per user per day", async () => {
        const results = [];
        for (let i = 0; i < 30; i++) {
            results.push(await runDeepResearch({
                projectKey: "ALPHA",
                issueKey: `ALPHA-${i + 1}`,
                userId: "user-rl",
                operationalSessionId: OP_SESSION_ID,
                analysisJob: makeJobStub(),
                timeoutMs: 500,
            }));
        }
        expect(results.every((r) => r.status === "ok")).toBe(true);
        expect(_getRequestsToday("user-rl")).toBe(30);
    });
    it("returns status: rate_limited on the 31st request", async () => {
        // Use up all 30
        for (let i = 0; i < 30; i++) {
            await runDeepResearch({
                projectKey: "ALPHA",
                issueKey: `ALPHA-${i + 1}`,
                userId: "user-rl2",
                operationalSessionId: OP_SESSION_ID,
                analysisJob: makeJobStub(),
                timeoutMs: 500,
            });
        }
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-31",
            userId: "user-rl2",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        expect(result.status).toBe("rate_limited");
        expect(result.message).toContain("30");
        expect(result.session_id).toBe("");
    });
    it("rate limit is per-user — different users are independent", async () => {
        // Fill user-A's limit
        for (let i = 0; i < 30; i++) {
            await runDeepResearch({
                projectKey: "ALPHA",
                issueKey: `ALPHA-${i + 1}`,
                userId: "user-A",
                operationalSessionId: OP_SESSION_ID,
                analysisJob: makeJobStub(),
                timeoutMs: 500,
            });
        }
        // user-B should still work
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-1",
            userId: "user-B",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        expect(result.status).toBe("ok");
    });
    it("rate_limited result does not produce an evidence_run_id", async () => {
        for (let i = 0; i < 30; i++) {
            await runDeepResearch({
                projectKey: "ALPHA",
                issueKey: `ALPHA-${i}`,
                userId: "user-rl3",
                operationalSessionId: OP_SESSION_ID,
                analysisJob: makeJobStub(),
                timeoutMs: 500,
            });
        }
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-X",
            userId: "user-rl3",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        expect(result.status).toBe("rate_limited");
        expect(result.evidence_run_id).toBeUndefined();
    });
});
// ---------------------------------------------------------------------------
// 5.4b — timeout handling
// ---------------------------------------------------------------------------
describe("5.4b – timeout handling", () => {
    it("returns status: timeout when job exceeds timeoutMs", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-T1",
            userId: "user-timeout",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(200), // job takes 200ms
            timeoutMs: 50, // timeout at 50ms
        });
        expect(result.status).toBe("timeout");
        expect(result.message).toContain("timed out");
        expect(result.elapsed_ms).toBeGreaterThanOrEqual(0);
    });
    it("timeout result includes a partial enriched_readiness", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-T2",
            userId: "user-timeout2",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(200),
            timeoutMs: 50,
        });
        expect(result.status).toBe("timeout");
        expect(result.enriched_readiness).toBeDefined();
    });
    it("timeout result is logged to evidence store", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-T3",
            userId: "user-timeout3",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(200),
            timeoutMs: 50,
        });
        expect(result.evidence_run_id).toBeTruthy();
        const bundle = evidenceStore.get(result.evidence_run_id);
        expect(bundle).toBeDefined();
        expect(bundle?.["status"]).toBe("timeout");
        expect(bundle?.["source"]).toBe("deep-research");
    });
    it("completed job (within timeout) returns status: ok", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-T4",
            userId: "user-ok",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(0),
            timeoutMs: 5000,
        });
        expect(result.status).toBe("ok");
        expect(result.findings).toHaveLength(1);
    });
});
// ---------------------------------------------------------------------------
// 5.4c — session isolation
// ---------------------------------------------------------------------------
describe("5.4c – session isolation", () => {
    it("research session_id is different from operational session_id", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-ISO-1",
            userId: "user-iso",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        expect(result.session_id).not.toBe(OP_SESSION_ID);
        expect(result.session_id).toMatch(/^[0-9a-f-]{36}$/);
    });
    it("each deep-research call gets a unique session_id", async () => {
        const r1 = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-ISO-2",
            userId: "user-iso2",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        const r2 = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-ISO-3",
            userId: "user-iso2",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        expect(r1.session_id).not.toBe(r2.session_id);
    });
});
// ---------------------------------------------------------------------------
// 5.4d — no shared state
// ---------------------------------------------------------------------------
describe("5.4d – no shared state between subagents", () => {
    it("job function receives the isolated session_id (not operational)", async () => {
        let capturedSessionId;
        await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-NS-1",
            userId: "user-ns",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: async (sid) => {
                capturedSessionId = sid;
                return { findings: [], enriched_readiness: {} };
            },
            timeoutMs: 500,
        });
        expect(capturedSessionId).toBeDefined();
        expect(capturedSessionId).not.toBe(OP_SESSION_ID);
    });
    it("two concurrent jobs for same user use different session_ids", async () => {
        const sessionIds = [];
        const [r1, r2] = await Promise.all([
            runDeepResearch({
                projectKey: "ALPHA",
                issueKey: "ALPHA-C-1",
                userId: "user-conc",
                operationalSessionId: OP_SESSION_ID,
                analysisJob: async (sid) => { sessionIds.push(sid); return { findings: [], enriched_readiness: {} }; },
                timeoutMs: 500,
            }),
            runDeepResearch({
                projectKey: "ALPHA",
                issueKey: "ALPHA-C-2",
                userId: "user-conc",
                operationalSessionId: OP_SESSION_ID,
                analysisJob: async (sid) => { sessionIds.push(sid); return { findings: [], enriched_readiness: {} }; },
                timeoutMs: 500,
            }),
        ]);
        expect(sessionIds).toHaveLength(2);
        expect(sessionIds[0]).not.toBe(sessionIds[1]);
    });
});
// ---------------------------------------------------------------------------
// 5.4e — all findings tagged source: "deep-research"
// ---------------------------------------------------------------------------
describe("5.4e – findings tagged source: deep-research", () => {
    it("all returned findings have source: 'deep-research'", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-TAG-1",
            userId: "user-tag",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: async (_sid) => ({
                findings: [
                    { source: "deep-research", text: "Finding A", confidence: 0.8 },
                    { source: "deep-research", text: "Finding B", confidence: 0.6, dimension: "scope_boundaries" },
                ],
                enriched_readiness: {},
            }),
            timeoutMs: 500,
        });
        expect(result.status).toBe("ok");
        result.findings.forEach((f) => {
            expect(f.source).toBe("deep-research");
        });
    });
    it("evidence bundle records source: deep-research", async () => {
        const result = await runDeepResearch({
            projectKey: "ALPHA",
            issueKey: "ALPHA-TAG-2",
            userId: "user-tag2",
            operationalSessionId: OP_SESSION_ID,
            analysisJob: makeJobStub(),
            timeoutMs: 500,
        });
        const bundle = evidenceStore.get(result.evidence_run_id);
        expect(bundle?.["source"]).toBe("deep-research");
    });
});
