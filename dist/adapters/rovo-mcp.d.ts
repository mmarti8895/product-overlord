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
import type { AdapterTrace } from "../types/index.js";
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
export declare class RovoMcpAdapter {
    private readonly baseUrl;
    private readonly cloudId;
    private readonly headers;
    private readonly retryDelayMs;
    constructor(config: RovoMcpConfig);
    getIssue(issueKey: string): Promise<{
        issue: RawIssue;
        trace: AdapterTrace;
    }>;
    searchIssues(jql: string, opts?: {
        maxResults?: number;
        startAt?: number;
    }): Promise<{
        result: SearchResult;
        trace: AdapterTrace;
    }>;
    naturalLanguageSearch(query: string, opts?: {
        limit?: number;
    }): Promise<{
        issues: RawIssue[];
        trace: AdapterTrace;
    }>;
    getProject(projectKey: string): Promise<{
        project: RawProject;
        trace: AdapterTrace;
    }>;
    private _trace;
}
