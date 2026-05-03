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
// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export class RovoMcpAdapter {
    baseUrl;
    cloudId;
    headers;
    retryDelayMs;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.cloudId = config.cloudId;
        this.retryDelayMs = config.retryDelayMs ?? 200;
        if (config.accessToken) {
            this.headers = {
                Authorization: `Bearer ${config.accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            };
        }
        else if (config.email && config.apiToken) {
            const token = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
            this.headers = {
                Authorization: `Basic ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            };
        }
        else {
            throw new Error("RovoMcpAdapter: provide either accessToken or email+apiToken");
        }
    }
    // -------------------------------------------------------------------------
    // getIssue
    // -------------------------------------------------------------------------
    async getIssue(issueKey) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const issue = await withRetry(async () => {
                retryCount++;
                const res = await fetch(`${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/issue/${issueKey}?expand=renderedFields,names`, { headers: this.headers });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                return (await res.json());
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1); // successful attempt count
            const trace = this._trace("getIssue", statusCode, Date.now() - start, retryCount);
            return { issue, trace };
        }
        catch (err) {
            const trace = this._trace("getIssue", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RovoMcp.getIssue failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // searchIssues (JQL)
    // -------------------------------------------------------------------------
    async searchIssues(jql, opts = {}) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const result = await withRetry(async () => {
                retryCount++;
                const res = await fetch(`${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/search`, {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify({
                        jql,
                        maxResults: opts.maxResults ?? 50,
                        startAt: opts.startAt ?? 0,
                        fields: ["*all"],
                    }),
                });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                return (await res.json());
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1);
            const trace = this._trace("searchIssues", statusCode, Date.now() - start, retryCount);
            return { result, trace };
        }
        catch (err) {
            const trace = this._trace("searchIssues", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RovoMcp.searchIssues failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // naturalLanguageSearch  (Rovo search endpoint)
    // -------------------------------------------------------------------------
    async naturalLanguageSearch(query, opts = {}) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const data = await withRetry(async () => {
                retryCount++;
                const res = await fetch(`${this.baseUrl}/search`, {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify({ query, limit: opts.limit ?? 20, cloudId: this.cloudId }),
                });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                return (await res.json());
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1);
            const trace = this._trace("naturalLanguageSearch", statusCode, Date.now() - start, retryCount);
            return { issues: data.results, trace };
        }
        catch (err) {
            const trace = this._trace("naturalLanguageSearch", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RovoMcp.naturalLanguageSearch failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // getProject
    // -------------------------------------------------------------------------
    async getProject(projectKey) {
        const start = Date.now();
        let retryCount = 0;
        let statusCode;
        try {
            const project = await withRetry(async () => {
                retryCount++;
                const res = await fetch(`${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/project/${projectKey}`, { headers: this.headers });
                statusCode = res.status;
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                return (await res.json());
            }, { baseDelayMs: this.retryDelayMs });
            retryCount = Math.max(0, retryCount - 1);
            const trace = this._trace("getProject", statusCode, Date.now() - start, retryCount);
            return { project, trace };
        }
        catch (err) {
            const trace = this._trace("getProject", statusCode, Date.now() - start, retryCount, String(err));
            throw Object.assign(new Error(`RovoMcp.getProject failed: ${err}`), { trace });
        }
    }
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    _trace(operation, statusCode, latencyMs, retryCount, error) {
        const trace = {
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
