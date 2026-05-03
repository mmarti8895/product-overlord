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
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export class McpResourceRegistry {
    /** repo://{repoFullName}/{componentName} */
    repoResources = new Map();
    /** pattern://{projectKey}/{ticketId} */
    patternResources = new Map();
    // -------------------------------------------------------------------------
    // Repo resources
    // -------------------------------------------------------------------------
    /** Register a component dossier under repo://{repoFullName}/{componentName} */
    registerComponent(repoFullName, dossier) {
        const uri = `repo://${repoFullName}/${dossier.name}`;
        this.repoResources.set(uri, dossier);
        logger.info("mcp_resource_registered", { uri });
    }
    /** Resolve repo://{repoFullName}/{componentName} → ComponentDossier or null */
    resolveRepo(repoFullName, componentName) {
        const uri = `repo://${repoFullName}/${componentName}`;
        return this.repoResources.get(uri) ?? null;
    }
    // -------------------------------------------------------------------------
    // Pattern resources
    // -------------------------------------------------------------------------
    /** Register a RepoMapResult under pattern://{projectKey}/{ticketId} */
    registerPattern(projectKey, ticketId, result) {
        const uri = `pattern://${projectKey}/${ticketId}`;
        this.patternResources.set(uri, result);
        logger.info("mcp_resource_registered", { uri });
    }
    /** Resolve pattern://{projectKey}/{ticketId} → RepoMapResult or null */
    resolvePattern(projectKey, ticketId) {
        const uri = `pattern://${projectKey}/${ticketId}`;
        return this.patternResources.get(uri) ?? null;
    }
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    /** List all registered URIs (for inspection / debugging) */
    listUris() {
        return [
            ...this.repoResources.keys(),
            ...this.patternResources.keys(),
        ];
    }
}
/** Singleton registry used across the process */
export const mcpRegistry = new McpResourceRegistry();
