/**
 * Ingestion Orchestrator
 *
 * Coordinates the dual-adapter ingestion strategy:
 *   - Primary board/backlog/sprint reads via Jira Agile REST
 *   - Rovo MCP fallback when Agile REST is unavailable
 *   - Direct issue key / JQL / NL search always via Rovo MCP
 *
 * Emits adapter traces for every call and surfaces `adapter_degraded`
 * when falling back, as required by spec.
 */
import { RovoMcpAdapter } from "./rovo-mcp.js";
import { JiraAgileRestAdapter } from "./jira-agile-rest.js";
import type { AdapterTrace } from "../types/index.js";
import type { RawIssue } from "./rovo-mcp.js";
export interface IngestionResult {
    issues: RawIssue[];
    traces: AdapterTrace[];
    /** Set when Agile REST was unavailable and we fell back to Rovo MCP */
    degraded?: {
        adapter: string;
        reason: string;
    };
    /** Projects that were inaccessible due to permission scope */
    inaccessibleProjects?: string[];
}
export declare class IngestionOrchestrator {
    private readonly rovo;
    private readonly agile;
    constructor(rovo: RovoMcpAdapter, agile: JiraAgileRestAdapter);
    ingestBoard(boardId: number): Promise<IngestionResult>;
    ingestBacklog(boardId: number): Promise<IngestionResult>;
    ingestSprint(sprintId: number): Promise<IngestionResult>;
    ingestIssue(issueKey: string): Promise<IngestionResult>;
    ingestJql(jql: string, opts?: {
        accessibleProjects?: string[];
    }): Promise<IngestionResult>;
    ingestNaturalLanguage(query: string): Promise<IngestionResult>;
    static isTotalFailure(err: unknown): boolean;
}
