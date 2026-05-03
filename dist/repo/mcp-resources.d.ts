/**
 * Repo Memory — MCP Resource Layer
 *
 * Exposes component indices as MCP-style resource URIs:
 *   repo://{repoFullName}/{componentName}  → ComponentDossier
 *   pattern://{projectKey}/{ticketId}      → RepoMapResult (if cached)
 *
 * This module does NOT handle HTTP transport — it provides the resolution
 * logic that an MCP server or local tool can delegate to.
 */
import type { ComponentDossier } from "./component-indexer.js";
import type { RepoMapResult } from "../types/index.js";
export declare class McpResourceRegistry {
    /** repo://{repoFullName}/{componentName} */
    private readonly repoResources;
    /** pattern://{projectKey}/{ticketId} */
    private readonly patternResources;
    /** Register a component dossier under repo://{repoFullName}/{componentName} */
    registerComponent(repoFullName: string, dossier: ComponentDossier): void;
    /** Resolve repo://{repoFullName}/{componentName} → ComponentDossier or null */
    resolveRepo(repoFullName: string, componentName: string): ComponentDossier | null;
    /** Register a RepoMapResult under pattern://{projectKey}/{ticketId} */
    registerPattern(projectKey: string, ticketId: string, result: RepoMapResult): void;
    /** Resolve pattern://{projectKey}/{ticketId} → RepoMapResult or null */
    resolvePattern(projectKey: string, ticketId: string): RepoMapResult | null;
    /** List all registered URIs (for inspection / debugging) */
    listUris(): string[];
}
/** Singleton registry used across the process */
export declare const mcpRegistry: McpResourceRegistry;
