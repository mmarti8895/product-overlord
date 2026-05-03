/**
 * Teamwork Graph Enrichment Layer (beta)
 *
 * Fetches linked PRs, branches, and builds from the Atlassian Teamwork Graph
 * to enrich component dossiers with historical co-change data.
 *
 * IMPORTANT: This data is flagged `enrichmentOnly: true` — it SHALL NOT serve
 * as the sole grounding for any ranking decision. It augments structural +
 * semantic retrieval but never replaces it.
 */

import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { AdapterTrace } from "../types/index.js";
import type { ComponentDossier, FixExample } from "./component-indexer.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface TeamworkGraphConfig {
  baseUrl: string;
  accessToken: string;
  /** Base delay for retry back-off in ms (default 200; set 0 in tests) */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface LinkedPR {
  id: string;
  title: string;
  url: string;
  status: "open" | "merged" | "closed";
  files: string[];
}

export interface LinkedBranch {
  name: string;
  url: string;
}

export interface LinkedBuild {
  id: string;
  status: "passing" | "failing" | "pending";
  url: string;
}

export interface TeamworkEnrichment {
  linkedPRs: LinkedPR[];
  linkedBranches: LinkedBranch[];
  linkedBuilds: LinkedBuild[];
  /**
   * Always true — enrichment data MUST NOT be sole grounding.
   * Consumers must combine this with semantic + structural signals.
   */
  enrichmentOnly: true;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class TeamworkGraphClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly retryDelayMs: number;

  constructor(config: TeamworkGraphConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.retryDelayMs = config.retryDelayMs ?? 200;
    this.headers = {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Fetch Teamwork Graph enrichment for a specific Jira issue key.
   * Returns `null` with `enrichment_source: unavailable` if the graph is unreachable.
   */
  async enrich(issueKey: string): Promise<TeamworkEnrichment | null> {
    try {
      const [prs, branches, builds] = await Promise.all([
        this._getLinkedPRs(issueKey),
        this._getLinkedBranches(issueKey),
        this._getLinkedBuilds(issueKey),
      ]);
      return { linkedPRs: prs, linkedBranches: branches, linkedBuilds: builds, enrichmentOnly: true };
    } catch (err) {
      logger.warn("teamwork_graph_unavailable", { issueKey, error: String(err) });
      return null;
    }
  }

  /**
   * Enrich component dossier fix-examples with PR history for a component's root paths.
   * Mutates the dossier in-place. Safe to call when graph is unavailable (no-op).
   */
  async enrichDossier(
    dossier: ComponentDossier,
    issueKey: string
  ): Promise<{ enriched: boolean; source: "teamwork_graph" | "unavailable" }> {
    const enrichment = await this.enrich(issueKey);
    if (!enrichment) return { enriched: false, source: "unavailable" };

    const relevantPRs = enrichment.linkedPRs.filter((pr) =>
      pr.files.some((f) => dossier.rootPaths.some((rp) => f.startsWith(rp)))
    );

    const examples: FixExample[] = relevantPRs.map((pr) => ({
      title: pr.title,
      paths: pr.files,
      summary: `PR ${pr.id} (${pr.status}) — ${pr.title}`,
    }));

    dossier.fixExamples.push(...examples);
    return { enriched: examples.length > 0, source: "teamwork_graph" };
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async _getLinkedPRs(issueKey: string): Promise<LinkedPR[]> {
    const start = Date.now();
    let retryCount = 0;

    const result = await withRetry(
      async () => {
        retryCount++;
        const url = `${this.baseUrl}/rest/dev-status/latest/issue/detail?issueId=${issueKey}&applicationType=github&dataType=pullrequest`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { detail?: Array<{ pullRequests?: Array<{ id: string; name: string; url: string; status: string; fileCount: number }> }> };
        const prs: LinkedPR[] = [];
        for (const detail of body.detail ?? []) {
          for (const pr of detail.pullRequests ?? []) {
            prs.push({
              id: pr.id,
              title: pr.name,
              url: pr.url,
              status: this._normalisePrStatus(pr.status),
              files: [],
            });
          }
        }
        return prs;
      },
      { maxAttempts: 3, baseDelayMs: this.retryDelayMs }
    );

    const trace: AdapterTrace = {
      adapter: "repo-adapter",
      operation: "getLinkedPRs",
      latencyMs: Date.now() - start,
      retryCount,
    };
    logger.info("adapter_call", trace as unknown as Record<string, unknown>);
    return result;
  }

  private async _getLinkedBranches(issueKey: string): Promise<LinkedBranch[]> {
    const start = Date.now();
    let retryCount = 0;

    const result = await withRetry(
      async () => {
        retryCount++;
        const url = `${this.baseUrl}/rest/dev-status/latest/issue/detail?issueId=${issueKey}&applicationType=github&dataType=branch`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { detail?: Array<{ branches?: Array<{ name: string; url: string }> }> };
        const branches: LinkedBranch[] = [];
        for (const detail of body.detail ?? []) {
          for (const b of detail.branches ?? []) {
            branches.push({ name: b.name, url: b.url });
          }
        }
        return branches;
      },
      { maxAttempts: 3, baseDelayMs: this.retryDelayMs }
    );

    const trace: AdapterTrace = {
      adapter: "repo-adapter",
      operation: "getLinkedBranches",
      latencyMs: Date.now() - start,
      retryCount,
    };
    logger.info("adapter_call", trace as unknown as Record<string, unknown>);
    return result;
  }

  private async _getLinkedBuilds(issueKey: string): Promise<LinkedBuild[]> {
    const start = Date.now();
    let retryCount = 0;

    const result = await withRetry(
      async () => {
        retryCount++;
        const url = `${this.baseUrl}/rest/dev-status/latest/issue/detail?issueId=${issueKey}&applicationType=github&dataType=build`;
        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { detail?: Array<{ builds?: Array<{ id: string; state: string; url: string }> }> };
        const builds: LinkedBuild[] = [];
        for (const detail of body.detail ?? []) {
          for (const b of detail.builds ?? []) {
            builds.push({
              id: String(b.id),
              status: this._normaliseBuildStatus(b.state),
              url: b.url,
            });
          }
        }
        return builds;
      },
      { maxAttempts: 3, baseDelayMs: this.retryDelayMs }
    );

    const trace: AdapterTrace = {
      adapter: "repo-adapter",
      operation: "getLinkedBuilds",
      latencyMs: Date.now() - start,
      retryCount,
    };
    logger.info("adapter_call", trace as unknown as Record<string, unknown>);
    return result;
  }

  private _normalisePrStatus(raw: string): LinkedPR["status"] {
    const s = raw.toLowerCase();
    if (s === "merged") return "merged";
    if (s === "closed" || s === "declined") return "closed";
    return "open";
  }

  private _normaliseBuildStatus(raw: string): LinkedBuild["status"] {
    const s = raw.toLowerCase();
    if (s === "successful" || s === "passing" || s === "success") return "passing";
    if (s === "failed" || s === "failing" || s === "failure") return "failing";
    return "pending";
  }
}
