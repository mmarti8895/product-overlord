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
import type { ComponentDossier } from "./component-indexer.js";
export interface TeamworkGraphConfig {
    baseUrl: string;
    accessToken: string;
    /** Base delay for retry back-off in ms (default 200; set 0 in tests) */
    retryDelayMs?: number;
}
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
export declare class TeamworkGraphClient {
    private readonly baseUrl;
    private readonly headers;
    private readonly retryDelayMs;
    constructor(config: TeamworkGraphConfig);
    /**
     * Fetch Teamwork Graph enrichment for a specific Jira issue key.
     * Returns `null` with `enrichment_source: unavailable` if the graph is unreachable.
     */
    enrich(issueKey: string): Promise<TeamworkEnrichment | null>;
    /**
     * Enrich component dossier fix-examples with PR history for a component's root paths.
     * Mutates the dossier in-place. Safe to call when graph is unavailable (no-op).
     */
    enrichDossier(dossier: ComponentDossier, issueKey: string): Promise<{
        enriched: boolean;
        source: "teamwork_graph" | "unavailable";
    }>;
    private _getLinkedPRs;
    private _getLinkedBranches;
    private _getLinkedBuilds;
    private _normalisePrStatus;
    private _normaliseBuildStatus;
}
