/**
 * Rovo MCP Adapter
 *
 * Wraps the Atlassian Rovo MCP server endpoints for:
 *   - getIssue
 *   - searchIssues (JQL)
 *   - naturalLanguageSearch
 *   - getProject
 *
 * Auth: OAuth 2.1 access token preferred; API token (Basic) as fallback.
 * Retry: ×3 with exponential back-off via withRetry().
 * Traces: every call emits an AdapterTrace via logger.adapterCall().
 */

import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { AdapterTrace } from "../types/index.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RovoMcpConfig {
  /** Base URL of the Rovo MCP server (e.g. https://api.atlassian.com/mcp) */
  baseUrl: string;
  /** OAuth 2.1 access token */
  accessToken?: string;
  /** Atlassian email for Basic/API-token auth (fallback) */
  email?: string;
  /** Atlassian API token for Basic auth (fallback) */
  apiToken?: string;
  /** Cloud ID / site identifier */
  cloudId: string;
  /** Base delay for retry back-off in ms (default 200; set to 0 in tests) */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Raw response shapes (minimal — extend as needed)
// ---------------------------------------------------------------------------

export interface RawIssue {
  key: string;
  fields: Record<string, unknown>;
}

export interface RawProject {
  key: string;
  name: string;
  id: string;
  fields?: Record<string, unknown>;
}

export interface SearchResult {
  issues: RawIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class RovoMcpAdapter {
  private readonly baseUrl: string;
  private readonly cloudId: string;
  private readonly headers: Record<string, string>;
  private readonly retryDelayMs: number;

  constructor(config: RovoMcpConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.cloudId = config.cloudId;
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
      throw new Error("RovoMcpAdapter: provide either accessToken or email+apiToken");
    }
  }

  // -------------------------------------------------------------------------
  // getIssue
  // -------------------------------------------------------------------------

  async getIssue(issueKey: string): Promise<{ issue: RawIssue; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const issue = await withRetry(
        async () => {
          retryCount++;
          const res = await fetch(
            `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/issue/${issueKey}?expand=renderedFields,names`,
            { headers: this.headers }
          );
          statusCode = res.status;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as RawIssue;
        },
        { baseDelayMs: this.retryDelayMs }
      );
      retryCount = Math.max(0, retryCount - 1); // successful attempt count
      const trace = this._trace("getIssue", statusCode, Date.now() - start, retryCount);
      return { issue, trace };
    } catch (err) {
      const trace = this._trace("getIssue", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.getIssue failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // searchIssues (JQL)
  // -------------------------------------------------------------------------

  async searchIssues(
    jql: string,
    opts: { maxResults?: number; startAt?: number } = {}
  ): Promise<{ result: SearchResult; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const result = await withRetry(async () => {
        retryCount++;
        const res = await fetch(
          `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/search`,
          {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
              jql,
              maxResults: opts.maxResults ?? 50,
              startAt: opts.startAt ?? 0,
              fields: ["*all"],
            }),
          }
        );
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SearchResult;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("searchIssues", statusCode, Date.now() - start, retryCount);
      return { result, trace };
    } catch (err) {
      const trace = this._trace("searchIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.searchIssues failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // naturalLanguageSearch  (Rovo search endpoint)
  // -------------------------------------------------------------------------

  async naturalLanguageSearch(
    query: string,
    opts: { limit?: number } = {}
  ): Promise<{ issues: RawIssue[]; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const data = await withRetry(async () => {
        retryCount++;
        const res = await fetch(`${this.baseUrl}/search`, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({ query, limit: opts.limit ?? 20, cloudId: this.cloudId }),
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { results: RawIssue[] };
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("naturalLanguageSearch", statusCode, Date.now() - start, retryCount);
      return { issues: data.results, trace };
    } catch (err) {
      const trace = this._trace("naturalLanguageSearch", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.naturalLanguageSearch failed: ${err}`), { trace });
    }
  }

  // -------------------------------------------------------------------------
  // getProject
  // -------------------------------------------------------------------------

  async getProject(projectKey: string): Promise<{ project: RawProject; trace: AdapterTrace }> {
    const start = Date.now();
    let retryCount = 0;
    let statusCode: number | undefined;

    try {
      const project = await withRetry(async () => {
        retryCount++;
        const res = await fetch(
          `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/project/${projectKey}`,
          { headers: this.headers }
        );
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as RawProject;
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getProject", statusCode, Date.now() - start, retryCount);
      return { project, trace };
    } catch (err) {
      const trace = this._trace("getProject", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.getProject failed: ${err}`), { trace });
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
      adapter: "rovo-mcp",
      operation,
      statusCode,
      latencyMs,
      retryCount,
      error,
    };
    logger.adapterCall({ adapter: "rovo-mcp", operation, statusCode, latencyMs, retryCount, error });
    return trace;
  }
}
