/**
 * Index Refresh Manager
 *
 * Manages incremental and full re-indexing of repository component indices.
 *
 * - Incremental refresh: triggered when index age > configured interval
 * - Full re-index: triggered on explicit request (e.g. repo reconnection)
 * - Index entries are stored in-memory (keyed by repoFullName)
 */
import { type ComponentIndex } from "./component-indexer.js";
import { RepoAdapter } from "./repo-adapter.js";
export interface IndexRefreshConfig {
    /** How often to auto-refresh in ms. Default: 30 minutes. */
    refreshIntervalMs?: number;
}
export interface RefreshResult {
    repoFullName: string;
    mode: "incremental" | "full";
    updatedComponents: number;
    unchangedComponents: number;
    indexedAt: string;
}
export declare class IndexRefreshManager {
    private readonly indexer;
    private readonly indices;
    private readonly refreshIntervalMs;
    constructor(config?: IndexRefreshConfig);
    /**
     * Return the cached index for a repo, performing an incremental refresh
     * if the index is stale (older than refreshIntervalMs).
     *
     * If no index exists, performs a full initial index.
     */
    getIndex(adapter: RepoAdapter, repoFullName: string): Promise<ComponentIndex>;
    /**
     * Force a full re-index regardless of staleness.
     * Use this when a repository is reconnected or explicitly requested.
     */
    forceFullReIndex(adapter: RepoAdapter, repoFullName: string): Promise<ComponentIndex>;
    /**
     * Return cached index without refreshing. Returns undefined if not indexed.
     */
    getCached(repoFullName: string): ComponentIndex | undefined;
    private _fullIndex;
    private _incrementalRefresh;
}
