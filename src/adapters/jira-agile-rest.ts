/**
 * Jira Agile REST Adapter
 *
 * Wraps the Jira Software Agile REST API (v1) for board/backlog/sprint operations:
 *   - listBoards
 *   - getBoardIssues
 *   - getBacklogIssues
 *   - getSprintIssues
 *   - getBoardConfig
 *   - listSprints
 *
 * Auth: same OAuth 2.1 / Basic strategy as RovoMcpAdapter.
 * Retry: ×3 with exponential back-off.
 * Traces: every call emits a structured AdapterTrace.
 */

import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { AdapterTrace } from "../types/index.js";
import type { RawIssue } from "./rovo-mcp.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface JiraAgileRestConfig {
  /** Base URL e.g. https://your-domain.atlassian.net */
  baseUrl: string;
  accessToken?: string;
  email?: string;
  apiToken?: string;
  /** Base delay for retry back-off in ms (default 200; set to 0 in tests) */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Raw response shapes
// ---------------------------------------------------------------------------

export interface RawBoard {
  id: number;
  name: string;
  type: string;
  self: string;
}

export interface RawSprint {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
  startDate?: string;
  endDate?: string;
}

export interface BoardConfig {
  id: number;
  name: string;
  columnConfig: { columns: Array<{ name: string; statuses: Array<{ id: string }> }> };
}

interface PagedBoards {
  values: RawBoard[];
  total: number;
  startAt: number;
  maxResults: number;
}

interface PagedIssues {
  issues: RawIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

interface PagedSprints {
  values: RawSprint[];
  total: number;
}

export interface RawEpic {
  id: number;
  key: string;
  name: string;
  summary: string;
  done: boolean;
  color?: { key: string };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class JiraAgileRestAdapter {
  private readonly baseUrl: string;
  private readonly agileBase: string;
  private readonly headers: Record<string, string>;
  private readonly retryDelayMs: number;

  constructor(config: JiraAgileRestConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.agileBase = `${this.baseUrl}/rest/agile/1.0`;
    this.retryDelayMs = config.retryDelayMs ?? 200;

    if (config.accessToken) {
      this.headers = {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
    } else if (config.email && config.apiToken) {
      const token = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
      this.headers = {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
    } else {
      throw new Error("JiraAgileRestAdapter: provide either accessToken or email+apiToken");
    }
  }

  // -------------------------------------------------------------------------
  // listBoards
  // -------------------------------------------------------------------------

  async listBoards(
    opts: { projectKeyOrId?: string; maxResults?: number; startAt?: number } = {}
  ): Promise<{ boards: RawBoard[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams();
        if (opts.projectKeyOrId) params.set("projectKeyOrId", opts.projectKeyOrId);
        params.set("maxResults", String(opts.maxResults ?? 50));
        params.set("startAt", String(opts.startAt ?? 0));
        const res = await fetch(`${this.agileBase}/board?${params}`, { headers: this.headers });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PagedBoards;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("listBoards", statusCode, Date.now() - start, retryCount);
      return { boards: data.values, trace };
    } catch (err) {
      const trace = this._trace("listBoards", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.listBoards failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getBoardIssues
  // -------------------------------------------------------------------------

  async getBoardIssues(
    boardId: number,
    opts: { maxResults?: number; startAt?: number } = {}
  ): Promise<{ issues: RawIssue[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({
          maxResults: String(opts.maxResults ?? 50),
          startAt: String(opts.startAt ?? 0),
        });
        const res = await fetch(`${this.agileBase}/board/${boardId}/issue?${params}`, {
          headers: this.headers,
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PagedIssues;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getBoardIssues", statusCode, Date.now() - start, retryCount);
      return { issues: data.issues, trace };
    } catch (err) {
      const trace = this._trace("getBoardIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getBoardIssues failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getBacklogIssues
  // -------------------------------------------------------------------------

  async getBacklogIssues(
    boardId: number,
    opts: { maxResults?: number; startAt?: number } = {}
  ): Promise<{ issues: RawIssue[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({
          maxResults: String(opts.maxResults ?? 50),
          startAt: String(opts.startAt ?? 0),
        });
        const res = await fetch(`${this.agileBase}/board/${boardId}/backlog?${params}`, {
          headers: this.headers,
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PagedIssues;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getBacklogIssues", statusCode, Date.now() - start, retryCount);
      return { issues: data.issues, trace };
    } catch (err) {
      const trace = this._trace("getBacklogIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getBacklogIssues failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getSprintIssues
  // -------------------------------------------------------------------------

  async getSprintIssues(
    sprintId: number,
    opts: { maxResults?: number; startAt?: number } = {}
  ): Promise<{ issues: RawIssue[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({
          maxResults: String(opts.maxResults ?? 50),
          startAt: String(opts.startAt ?? 0),
        });
        const res = await fetch(`${this.agileBase}/sprint/${sprintId}/issue?${params}`, {
          headers: this.headers,
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PagedIssues;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getSprintIssues", statusCode, Date.now() - start, retryCount);
      return { issues: data.issues, trace };
    } catch (err) {
      const trace = this._trace("getSprintIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getSprintIssues failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getBoardConfig
  // -------------------------------------------------------------------------

  async getBoardConfig(boardId: number): Promise<{ config: BoardConfig; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const config = await withRetry(async () => {
        retryCount++;
        const res = await fetch(`${this.agileBase}/board/${boardId}/configuration`, {
          headers: this.headers,
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as BoardConfig;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getBoardConfig", statusCode, Date.now() - start, retryCount);
      return { config, trace };
    } catch (err) {
      const trace = this._trace("getBoardConfig", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getBoardConfig failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // listSprints
  // -------------------------------------------------------------------------

  async listSprints(
    boardId: number,
    opts: { state?: "active" | "future" | "closed"; maxResults?: number } = {}
  ): Promise<{ sprints: RawSprint[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({ maxResults: String(opts.maxResults ?? 50) });
        if (opts.state) params.set("state", opts.state);
        const res = await fetch(`${this.agileBase}/board/${boardId}/sprint?${params}`, {
          headers: this.headers,
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as PagedSprints;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("listSprints", statusCode, Date.now() - start, retryCount);
      return { sprints: data.values, trace };
    } catch (err) {
      const trace = this._trace("listSprints", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.listSprints failed: ${err}`), { trace });
    }
  }

  async getEpicsForBoard(
    boardId: number,
    opts: { maxResults?: number } = {}
  ): Promise<{ epics: RawEpic[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({ maxResults: String(opts.maxResults ?? 100) });
        const res = await fetch(`${this.agileBase}/board/${boardId}/epic?${params}`, {
          headers: this.headers,
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { values: RawEpic[] };
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getEpicsForBoard", statusCode, Date.now() - start, retryCount);
      return { epics: data.values, trace };
    } catch (err) {
      const trace = this._trace("getEpicsForBoard", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getEpicsForBoard failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // createStory — creates a Story issue in the given project
  // -------------------------------------------------------------------------

  async createStory(
    projectKey: string,
    opts: { summary: string; description: string; labels?: string[] },
  ): Promise<string> {
    const start = Date.now();
    let statusCode: number | undefined;
    try {
      const body = {
        fields: {
          project: { key: projectKey },
          summary: opts.summary,
          description: opts.description,
          issuetype: { name: "Story" },
          labels: opts.labels ?? [],
        },
      };
      const resp = await fetch(`${this.baseUrl}/rest/api/3/issue`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
      });
      statusCode = resp.status;
      if (!resp.ok) throw new Error(`Jira createStory HTTP ${resp.status}`);
      const data = (await resp.json()) as { key: string };
      this._trace("createStory", statusCode, Date.now() - start, 0);
      return data.key;
    } catch (err) {
      this._trace("createStory", statusCode, Date.now() - start, 0, String(err));
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private _trace(
    operation: string,
    statusCode: number | undefined,
    latencyMs: number,
    retryCount: number,
    error?: string
  ): AdapterTrace {
    const trace: AdapterTrace = {
      adapter: "jira-agile-rest",
      operation,
      statusCode,
      latencyMs,
      retryCount,
      error,
    };
    logger.adapterCall({ adapter: "jira-agile-rest", operation, statusCode, latencyMs, retryCount, error });
    return trace;
  }
}
