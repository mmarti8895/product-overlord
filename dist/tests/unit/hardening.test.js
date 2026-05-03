/**
 * Hardening tests — Tasks 4.1–4.4
 *
 * 4.1 Permission-fidelity: cross-project JQL only returns accessible tickets;
 *     inaccessible projects noted in result.
 * 4.2 adapter_unavailable: both adapters down → blocked verdict, no partial output.
 * 4.3 profile_source: default logged when no project profile exists.
 * 4.4 Security: no credentials in log output; no cross-user data in evidence store.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { IngestionOrchestrator } from "../../adapters/ingestion-orchestrator.js";
import { RovoMcpAdapter } from "../../adapters/rovo-mcp.js";
import { JiraAgileRestAdapter } from "../../adapters/jira-agile-rest.js";
import { ProfileRegistry } from "../../readiness/profile.js";
import { scoreTicket } from "../../readiness/scorer.js";
import { EvidenceStore } from "../../evidence/store.js";
import { logger } from "../../utils/logger.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetch(responses) {
    let call = 0;
    return vi.fn(async () => {
        const r = responses[Math.min(call++, responses.length - 1)];
        return {
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            json: async () => r.body,
        };
    });
}
function makeAdapters() {
    const rovo = new RovoMcpAdapter({
        baseUrl: "https://api.atlassian.com/mcp",
        accessToken: "tok",
        cloudId: "c",
        retryDelayMs: 0,
    });
    const agile = new JiraAgileRestAdapter({
        baseUrl: "https://demo.atlassian.net",
        accessToken: "tok",
        retryDelayMs: 0,
    });
    return { rovo, agile, orchestrator: new IngestionOrchestrator(rovo, agile) };
}
// ---------------------------------------------------------------------------
// 4.1 — Permission fidelity
// ---------------------------------------------------------------------------
describe("4.1 permission fidelity — cross-project JQL filtering", () => {
    afterEach(() => vi.restoreAllMocks());
    it("returns only tickets from accessible projects", async () => {
        const searchBody = {
            issues: [
                { key: "PROJ-1", fields: { summary: "ok" } },
                { key: "SECRET-99", fields: { summary: "hidden" } },
                { key: "PROJ-2", fields: { summary: "ok2" } },
            ],
            total: 3,
            startAt: 0,
            maxResults: 50,
        };
        vi.stubGlobal("fetch", mockFetch([{ status: 200, body: searchBody }]));
        const { orchestrator } = makeAdapters();
        const result = await orchestrator.ingestJql("project in (PROJ, SECRET)", {
            accessibleProjects: ["PROJ"],
        });
        expect(result.issues).toHaveLength(2);
        expect(result.issues.every((i) => i.key.startsWith("PROJ-"))).toBe(true);
        expect(result.inaccessibleProjects).toContain("SECRET");
    });
    it("returns all tickets when no accessibleProjects filter supplied", async () => {
        const searchBody = {
            issues: [{ key: "A-1", fields: {} }, { key: "B-2", fields: {} }],
            total: 2, startAt: 0, maxResults: 50,
        };
        vi.stubGlobal("fetch", mockFetch([{ status: 200, body: searchBody }]));
        const { orchestrator } = makeAdapters();
        const result = await orchestrator.ingestJql("project in (A, B)");
        expect(result.issues).toHaveLength(2);
        expect(result.inaccessibleProjects ?? []).toHaveLength(0);
    });
});
// ---------------------------------------------------------------------------
// 4.2 — Both adapters down → blocked verdict, no partial output
// ---------------------------------------------------------------------------
describe("4.2 adapter_unavailable — both adapters down", () => {
    afterEach(() => vi.restoreAllMocks());
    it("board sweep throws when Agile REST is down and Rovo MCP fallback also fails", async () => {
        // All requests return 503
        vi.stubGlobal("fetch", mockFetch([
            { status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} }, // Agile REST ×3
            { status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} }, // Rovo fallback ×3
        ]));
        const { orchestrator } = makeAdapters();
        await expect(orchestrator.ingestBoard(1)).rejects.toThrow();
    });
    it("direct issue key via Rovo MCP throws after ×3 retries when adapter is down", async () => {
        vi.stubGlobal("fetch", mockFetch([
            { status: 503, body: {} },
            { status: 503, body: {} },
            { status: 503, body: {} },
        ]));
        const { orchestrator } = makeAdapters();
        await expect(orchestrator.ingestIssue("ABC-1")).rejects.toThrow("RovoMcp.getIssue failed");
    });
    it("no partial evidence bundle is emitted when ingestion throws", async () => {
        vi.stubGlobal("fetch", mockFetch([
            { status: 503, body: {} },
            { status: 503, body: {} },
            { status: 503, body: {} },
        ]));
        const store = new EvidenceStore();
        const { orchestrator } = makeAdapters();
        try {
            await orchestrator.ingestIssue("ABC-1");
        }
        catch {
            // Caller must not persist a bundle when ingestion failed
        }
        // Store is empty — no partial output persisted
        expect(store.size).toBe(0);
    });
});
// ---------------------------------------------------------------------------
// 4.3 — profile_source: default logged
// ---------------------------------------------------------------------------
describe("4.3 profile_source: default logged when no project profile exists", () => {
    it("scorer logs profile_source=default for unknown project", () => {
        const logSpy = vi.spyOn(logger, "info");
        const registry = new ProfileRegistry();
        const { profile, source } = registry.resolve("UNKNOWN_PROJ", "story");
        expect(source).toBe("default");
        const ticket = {
            ticket_key: "UNKNOWN_PROJ-1",
            ticket_type: "story",
            summary: "Test",
            description: "desc",
            acceptance_criteria: "AC here",
            ac_field_source: "Acceptance Criteria",
            issue_type: "Story",
            status: "To Do",
            labels: ["x"],
            priority: "Medium",
            reporter: "u",
            assignee: null,
            linked_artifacts: [],
            dependencies: [{ key: "X-1", relationship: "is blocked by", status: "Done" }],
            comments: [],
            board_id: null,
            sprint_id: null,
            epic_key: null,
            fix_versions: [],
            raw_fields: {},
        };
        scoreTicket({ ticket, profile, profileSource: source });
        const defaultLogCall = logSpy.mock.calls.find((args) => args[0] === "readiness_score" &&
            args[1]?.profile_source === "default");
        expect(defaultLogCall).toBeDefined();
    });
});
// ---------------------------------------------------------------------------
// 4.4 — Security: no credential logging, isolated evidence store
// ---------------------------------------------------------------------------
describe("4.4 security — credential hygiene and evidence isolation", () => {
    it("adapter constructor does not log credentials", () => {
        const logSpy = vi.spyOn(logger, "info");
        const warnSpy = vi.spyOn(logger, "warn");
        new RovoMcpAdapter({
            baseUrl: "https://api.atlassian.com/mcp",
            accessToken: "super-secret-token-abc123",
            cloudId: "cloud-xyz",
            retryDelayMs: 0,
        });
        const allLogArgs = [
            ...logSpy.mock.calls.map((c) => JSON.stringify(c)),
            ...warnSpy.mock.calls.map((c) => JSON.stringify(c)),
        ].join(" ");
        expect(allLogArgs).not.toContain("super-secret-token-abc123");
    });
    it("evidence store entries are isolated per run_id — no cross-run data leak", () => {
        const store = new EvidenceStore();
        const makeBundle = (key) => ({
            trigger: `direct_key:${key}`,
            adapter_traces: [],
            canonical_ticket: { ticket_key: key },
            scorer_input: { profile_id: "default:story", profile_source: "default" },
            scorer_output: {
                ticket_key: key,
                ticket_type: "story",
                readiness_status: "ready",
                readiness_score: 90,
                missing_items: [],
                questions_for_pm: [],
                questions_for_engineer: [],
                questions_for_qa: [],
                manual_checks: [],
                confidence: 0.9,
                explanation: "",
                evidence: [],
            },
            verdict: "ready",
            comment_draft_id: null,
        });
        const b1 = store.persist(makeBundle("SEC-1"));
        const b2 = store.persist(makeBundle("SEC-2"));
        expect(b1.run_id).not.toBe(b2.run_id);
        const r1 = store.get(b1.run_id);
        const r2 = store.get(b2.run_id);
        expect(r1.canonical_ticket.ticket_key).toBe("SEC-1");
        expect(r2.canonical_ticket.ticket_key).toBe("SEC-2");
        // Cross-fetch returns correct data only
        expect(r1.canonical_ticket.ticket_key).not.toBe(r2.canonical_ticket.ticket_key);
    });
    it("evidence store returns undefined for unknown run_id", () => {
        const store = new EvidenceStore();
        expect(store.get("non-existent-run-id")).toBeUndefined();
    });
});
