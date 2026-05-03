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
import type { AdapterTrace } from "../types/index.js";
import type { RawIssue } from "./rovo-mcp.js";
export interface JiraAgileRestConfig {
    /** Base URL e.g. https://your-domain.atlassian.net */
    baseUrl: string;
    accessToken?: string;
    email?: string;
    apiToken?: string;
    /** Base delay for retry back-off in ms (default 200; set to 0 in tests) */
    retryDelayMs?: number;
}
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
    columnConfig: {
        columns: Array<{
            name: string;
            statuses: Array<{
                id: string;
            }>;
        }>;
    };
}
export interface RawEpic {
    id: number;
    key: string;
    name: string;
    summary: string;
    done: boolean;
    color?: {
        key: string;
    };
}
export declare class JiraAgileRestAdapter {
    private readonly baseUrl;
    private readonly agileBase;
    private readonly headers;
    private readonly retryDelayMs;
    constructor(config: JiraAgileRestConfig);
    listBoards(opts?: {
        projectKeyOrId?: string;
        maxResults?: number;
        startAt?: number;
    }): Promise<{
        boards: RawBoard[];
        trace: AdapterTrace;
    }>;
    getBoardIssues(boardId: number, opts?: {
        maxResults?: number;
        startAt?: number;
    }): Promise<{
        issues: RawIssue[];
        trace: AdapterTrace;
    }>;
    getBacklogIssues(boardId: number, opts?: {
        maxResults?: number;
        startAt?: number;
    }): Promise<{
        issues: RawIssue[];
        trace: AdapterTrace;
    }>;
    getSprintIssues(sprintId: number, opts?: {
        maxResults?: number;
        startAt?: number;
    }): Promise<{
        issues: RawIssue[];
        trace: AdapterTrace;
    }>;
    getBoardConfig(boardId: number): Promise<{
        config: BoardConfig;
        trace: AdapterTrace;
    }>;
    listSprints(boardId: number, opts?: {
        state?: "active" | "future" | "closed";
        maxResults?: number;
    }): Promise<{
        sprints: RawSprint[];
        trace: AdapterTrace;
    }>;
    getEpicsForBoard(boardId: number, opts?: {
        maxResults?: number;
    }): Promise<{
        epics: RawEpic[];
        trace: AdapterTrace;
    }>;
    createStory(projectKey: string, opts: {
        summary: string;
        description: string;
        labels?: string[];
    }): Promise<string>;
    private _trace;
}
