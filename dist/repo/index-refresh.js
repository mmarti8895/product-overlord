/**
 * Index Refresh Manager
 *
 * Manages incremental and full re-indexing of repository component indices.
 *
 * - Incremental refresh: triggered when index age > configured interval
 * - Full re-index: triggered on explicit request (e.g. repo reconnection)
 * - Index entries are stored in-memory (keyed by repoFullName)
 */
import { ComponentIndexer } from "./component-indexer.js";
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------
export class IndexRefreshManager {
    indexer = new ComponentIndexer();
    indices = new Map();
    refreshIntervalMs;
    constructor(config = {}) {
        this.refreshIntervalMs = config.refreshIntervalMs ?? 30 * 60 * 1000;
    }
    /**
     * Return the cached index for a repo, performing an incremental refresh
     * if the index is stale (older than refreshIntervalMs).
     *
     * If no index exists, performs a full initial index.
     */
    async getIndex(adapter, repoFullName) {
        const existing = this.indices.get(repoFullName);
        if (!existing) {
            return this._fullIndex(adapter, repoFullName);
        }
        const ageMs = Date.now() - new Date(existing.indexedAt).getTime();
        if (ageMs > this.refreshIntervalMs) {
            return this._incrementalRefresh(adapter, repoFullName, existing);
        }
        return existing;
    }
    /**
     * Force a full re-index regardless of staleness.
     * Use this when a repository is reconnected or explicitly requested.
     */
    async forceFullReIndex(adapter, repoFullName) {
        return this._fullIndex(adapter, repoFullName);
    }
    /**
     * Return cached index without refreshing. Returns undefined if not indexed.
     */
    getCached(repoFullName) {
        return this.indices.get(repoFullName);
    }
    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------
    async _fullIndex(adapter, repoFullName) {
        logger.info("index_refresh", { mode: "full", repoFullName });
        const [owner, repo] = repoFullName.split("/");
        const { meta } = await adapter.getRepoMeta(owner, repo);
        const { entries } = await adapter.getTree(owner, repo, meta.defaultBranch);
        const index = this.indexer.index(repoFullName, entries);
        this.indices.set(repoFullName, index);
        logger.info("index_refresh_complete", {
            mode: "full",
            repoFullName,
            components: index.components.length,
        });
        return index;
    }
    async _incrementalRefresh(adapter, repoFullName, previous) {
        logger.info("index_refresh", { mode: "incremental", repoFullName });
        const [owner, repo] = repoFullName.split("/");
        const { meta } = await adapter.getRepoMeta(owner, repo);
        const { entries } = await adapter.getTree(owner, repo, meta.defaultBranch);
        const { updated, unchanged } = this.indexer.diff(previous, entries);
        // Merge: updated components replace previous; unchanged kept as-is
        const merged = [
            ...updated,
            ...unchanged,
        ];
        const index = {
            repoFullName,
            indexedAt: new Date().toISOString(),
            components: merged,
        };
        this.indices.set(repoFullName, index);
        logger.info("index_refresh_complete", {
            mode: "incremental",
            repoFullName,
            updatedComponents: updated.length,
            unchangedComponents: unchanged.length,
        });
        return index;
    }
}
