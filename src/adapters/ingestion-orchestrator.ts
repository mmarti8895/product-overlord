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
import { logger } from "../utils/logger.js";
import type { AdapterTrace } from "../types/index.js";
import type { RawIssue } from "./rovo-mcp.js";

export interface IngestionResult {
  issues: RawIssue[];
  traces: AdapterTrace[];
  /** Set when Agile REST was unavailable and we fell back to Rovo MCP */
  degraded?: { adapter: string; reason: string };
  /** Projects that were inaccessible due to permission scope */
  inaccessibleProjects?: string[];
}

export class IngestionOrchestrator {
  constructor(
    private readonly rovo: RovoMcpAdapter,
    private readonly agile: JiraAgileRestAdapter
  ) {}

  // -------------------------------------------------------------------------
  // Board sweep — primary: Agile REST, fallback: Rovo MCP JQL
  // -------------------------------------------------------------------------

  async ingestBoard(boardId: number): Promise<IngestionResult> {
    const traces: AdapterTrace[] = [];
    try {
      const { issues, trace } = await this.agile.getBoardIssues(boardId);
      traces.push(trace);
      return { issues, traces };
    } catch (err) {
      const failedTrace = (err as { trace?: AdapterTrace }).trace;
      if (failedTrace) {
        traces.push({ ...failedTrace, degraded: true });
      }
      logger.warn("adapter_degraded: jira-agile-rest — falling back to Rovo MCP", {
        boardId,
        error: String(err),
      });
      // Fallback: fetch active sprint issues via JQL
      const { result, trace: rvTrace } = await this.rovo.searchIssues(
        `sprint in openSprints() ORDER BY created DESC`
      );
      traces.push(rvTrace);
      return {
        issues: result.issues,
        traces,
        degraded: { adapter: "jira-agile-rest", reason: String(err) },
      };
    }
  }

  // -------------------------------------------------------------------------
  // Backlog sweep — primary: Agile REST, fallback: Rovo MCP JQL
  // -------------------------------------------------------------------------

  async ingestBacklog(boardId: number): Promise<IngestionResult> {
    const traces: AdapterTrace[] = [];
    try {
      const { issues, trace } = await this.agile.getBacklogIssues(boardId);
      traces.push(trace);
      return { issues, traces };
    } catch (err) {
      const failedTrace = (err as { trace?: AdapterTrace }).trace;
      if (failedTrace) traces.push({ ...failedTrace, degraded: true });
      logger.warn("adapter_degraded: jira-agile-rest (backlog) — falling back to Rovo MCP", {
        boardId,
        error: String(err),
      });
      const { result, trace: rvTrace } = await this.rovo.searchIssues(
        `sprint is EMPTY AND statusCategory != Done ORDER BY created DESC`
      );
      traces.push(rvTrace);
      return {
        issues: result.issues,
        traces,
        degraded: { adapter: "jira-agile-rest", reason: String(err) },
      };
    }
  }

  // -------------------------------------------------------------------------
  // Sprint sweep — primary: Agile REST, fallback: Rovo MCP JQL
  // -------------------------------------------------------------------------

  async ingestSprint(sprintId: number): Promise<IngestionResult> {
    const traces: AdapterTrace[] = [];
    try {
      const { issues, trace } = await this.agile.getSprintIssues(sprintId);
      traces.push(trace);
      return { issues, traces };
    } catch (err) {
      const failedTrace = (err as { trace?: AdapterTrace }).trace;
      if (failedTrace) traces.push({ ...failedTrace, degraded: true });
      logger.warn("adapter_degraded: jira-agile-rest (sprint) — falling back to Rovo MCP", {
        sprintId,
        error: String(err),
      });
      const { result, trace: rvTrace } = await this.rovo.searchIssues(
        `sprint = ${sprintId} ORDER BY created DESC`
      );
      traces.push(rvTrace);
      return {
        issues: result.issues,
        traces,
        degraded: { adapter: "jira-agile-rest", reason: String(err) },
      };
    }
  }

  // -------------------------------------------------------------------------
  // Direct issue key — always Rovo MCP
  // -------------------------------------------------------------------------

  async ingestIssue(issueKey: string): Promise<IngestionResult> {
    const { issue, trace } = await this.rovo.getIssue(issueKey);
    return { issues: [issue], traces: [trace] };
  }

  // -------------------------------------------------------------------------
  // JQL search — always Rovo MCP
  // -------------------------------------------------------------------------

  async ingestJql(
    jql: string,
    opts: { accessibleProjects?: string[] } = {}
  ): Promise<IngestionResult> {
    const { result, trace } = await this.rovo.searchIssues(jql);
    const traces = [trace];

    // Permission fidelity: if accessible project list provided, filter and flag inaccessible ones
    let issues = result.issues;
    const inaccessibleProjects: string[] = [];

    if (opts.accessibleProjects && opts.accessibleProjects.length > 0) {
      const accessible = new Set(opts.accessibleProjects.map((p) => p.toUpperCase()));
      const before = issues.length;
      issues = issues.filter((i) => {
        const proj = i.key.split("-")[0].toUpperCase();
        if (!accessible.has(proj)) {
          if (!inaccessibleProjects.includes(proj)) inaccessibleProjects.push(proj);
          return false;
        }
        return true;
      });
      if (before !== issues.length) {
        logger.warn("permission_filter: removed inaccessible project issues", {
          inaccessibleProjects,
          removed: before - issues.length,
        });
      }
    }

    return { issues, traces, inaccessibleProjects };
  }

  // -------------------------------------------------------------------------
  // Natural-language search — always Rovo MCP
  // -------------------------------------------------------------------------

  async ingestNaturalLanguage(query: string): Promise<IngestionResult> {
    const { issues, trace } = await this.rovo.naturalLanguageSearch(query);
    return { issues, traces: [trace] };
  }

  // -------------------------------------------------------------------------
  // Both-adapters-down guard — used by callers to detect total failure
  // -------------------------------------------------------------------------

  static isTotalFailure(err: unknown): boolean {
    const msg = String(err);
    return msg.includes("adapter_unavailable") || msg.includes("failed");
  }
}
