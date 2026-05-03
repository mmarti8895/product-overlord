/**
 * Contract tests for RovoMcpAdapter and JiraAgileRestAdapter
 * Uses fetch mocking (no real network calls).
 *
 * Covers: happy path, 5xx retry behaviour, 401 rejection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RovoMcpAdapter } from "../../adapters/rovo-mcp.js";
import { JiraAgileRestAdapter } from "../../adapters/jira-agile-rest.js";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body,
    } as Response;
  });
}

// ---------------------------------------------------------------------------
// RovoMcpAdapter
// ---------------------------------------------------------------------------

describe("RovoMcpAdapter — contract tests", () => {
  let adapter: RovoMcpAdapter;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new RovoMcpAdapter({
      baseUrl: "https://api.atlassian.com/mcp",
      accessToken: "test-token",
      cloudId: "cloud-123",
      retryDelayMs: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getIssue — happy path returns raw issue", async () => {
    const rawIssue = { key: "ABC-1", fields: { summary: "Test" } };
    fetchSpy = mockFetch([{ status: 200, body: rawIssue }]);
    vi.stubGlobal("fetch", fetchSpy);

    const { issue, trace } = await adapter.getIssue("ABC-1");
    expect(issue.key).toBe("ABC-1");
    expect(trace.adapter).toBe("rovo-mcp");
    expect(trace.statusCode).toBe(200);
    expect(trace.retryCount).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("getIssue — retries on 5xx and succeeds on 3rd attempt", async () => {
    const rawIssue = { key: "ABC-1", fields: {} };
    fetchSpy = mockFetch([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 200, body: rawIssue },
    ]);
    vi.stubGlobal("fetch", fetchSpy);

    // Use zero base delay to keep tests fast
    const fastAdapter = new RovoMcpAdapter({
      baseUrl: "https://api.atlassian.com/mcp",
      accessToken: "t",
      cloudId: "c",
      retryDelayMs: 0,
    });
    const { issue } = await fastAdapter.getIssue("ABC-1");
    expect(issue.key).toBe("ABC-1");
    expect(fetchSpy.mock.calls.length).toBe(3);
  });

  it("getIssue — throws after 3 failed 5xx attempts", async () => {
    fetchSpy = mockFetch([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 503, body: {} },
    ]);
    vi.stubGlobal("fetch", fetchSpy);

    await expect(adapter.getIssue("ABC-1")).rejects.toThrow("RovoMcp.getIssue failed");
    expect(fetchSpy.mock.calls.length).toBe(3);
  });

  it("getIssue — throws immediately on 401 (auth error propagates)", async () => {
    fetchSpy = mockFetch([{ status: 401, body: { message: "Unauthorized" } }]);
    vi.stubGlobal("fetch", fetchSpy);

    // 401 is still a non-ok response — adapter retries then throws
    await expect(adapter.getIssue("ABC-1")).rejects.toThrow();
  });

  it("searchIssues — happy path returns issues array", async () => {
    const body = { issues: [{ key: "ABC-1", fields: {} }], total: 1, startAt: 0, maxResults: 50 };
    fetchSpy = mockFetch([{ status: 200, body }]);
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = await adapter.searchIssues("project = ABC");
    expect(result.issues).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("naturalLanguageSearch — happy path returns issues", async () => {
    fetchSpy = mockFetch([{ status: 200, body: { results: [{ key: "X-1", fields: {} }] } }]);
    vi.stubGlobal("fetch", fetchSpy);

    const { issues } = await adapter.naturalLanguageSearch("payment bugs");
    expect(issues).toHaveLength(1);
    expect(issues[0].key).toBe("X-1");
  });

  it("getProject — happy path", async () => {
    fetchSpy = mockFetch([{ status: 200, body: { key: "ABC", name: "Alpha", id: "10001" } }]);
    vi.stubGlobal("fetch", fetchSpy);

    const { project } = await adapter.getProject("ABC");
    expect(project.key).toBe("ABC");
  });

  it("throws when neither accessToken nor email+apiToken provided", () => {
    expect(
      () => new RovoMcpAdapter({ baseUrl: "https://x", cloudId: "c" })
    ).toThrow("provide either accessToken");
  });
});

// ---------------------------------------------------------------------------
// JiraAgileRestAdapter
// ---------------------------------------------------------------------------

describe("JiraAgileRestAdapter — contract tests", () => {
  let adapter: JiraAgileRestAdapter;

  beforeEach(() => {
    adapter = new JiraAgileRestAdapter({
      baseUrl: "https://mysite.atlassian.net",
      accessToken: "test-token",
      retryDelayMs: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listBoards — happy path", async () => {
    const body = { values: [{ id: 1, name: "Main", type: "scrum", self: "..." }], total: 1, startAt: 0, maxResults: 50 };
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body }]));

    const { boards } = await adapter.listBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].id).toBe(1);
  });

  it("getBoardIssues — happy path", async () => {
    const body = { issues: [{ key: "T-1", fields: {} }], total: 1, startAt: 0, maxResults: 50 };
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body }]));

    const { issues } = await adapter.getBoardIssues(1);
    expect(issues).toHaveLength(1);
  });

  it("getBacklogIssues — happy path", async () => {
    const body = { issues: [{ key: "T-2", fields: {} }], total: 1, startAt: 0, maxResults: 50 };
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body }]));

    const { issues } = await adapter.getBacklogIssues(1);
    expect(issues[0].key).toBe("T-2");
  });

  it("getSprintIssues — happy path", async () => {
    const body = { issues: [{ key: "T-3", fields: {} }], total: 1, startAt: 0, maxResults: 50 };
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body }]));

    const { issues } = await adapter.getSprintIssues(42);
    expect(issues[0].key).toBe("T-3");
  });

  it("getBoardConfig — happy path", async () => {
    const body = { id: 1, name: "Board", columnConfig: { columns: [] } };
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body }]));

    const { config } = await adapter.getBoardConfig(1);
    expect(config.id).toBe(1);
  });

  it("listSprints — happy path", async () => {
    const body = { values: [{ id: 7, name: "Sprint 1", state: "active" }], total: 1 };
    vi.stubGlobal("fetch", mockFetch([{ status: 200, body }]));

    const { sprints } = await adapter.listSprints(1);
    expect(sprints[0].state).toBe("active");
  });

  it("listBoards — retries on 5xx, then throws", async () => {
    vi.stubGlobal("fetch", mockFetch([
      { status: 500, body: {} },
      { status: 500, body: {} },
      { status: 500, body: {} },
    ]));

    await expect(adapter.listBoards()).rejects.toThrow("JiraAgile.listBoards failed");
  });

  it("listBoards — 401 propagates as error", async () => {
    vi.stubGlobal("fetch", mockFetch([{ status: 401, body: {} }]));
    await expect(adapter.listBoards()).rejects.toThrow();
  });

  it("throws when no auth provided", () => {
    expect(
      () => new JiraAgileRestAdapter({ baseUrl: "https://x" })
    ).toThrow("provide either accessToken");
  });
});
