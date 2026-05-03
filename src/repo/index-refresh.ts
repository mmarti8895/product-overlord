/**
 * Index Refresh Manager
 *
 * Manages incremental and full re-indexing of repository component indices.
 *
 * - Incremental refresh: triggered when index age > configured interval
 * - Full re-index: triggered on explicit request (e.g. repo reconnection)
 * - Index entries are stored in-memory (keyed by repoFullName)
 */

import { ComponentIndexer, type ComponentIndex, type ComponentDossier } from "./component-indexer.js";
import { RepoAdapter } from "./repo-adapter.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface IndexRefreshConfig {
  /** How often to auto-refresh in ms. Default: 30 minutes. */
  refreshIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Refresh result
// ---------------------------------------------------------------------------

export interface RefreshResult {
  repoFullName: string;
  mode: "incremental" | "full";
  updatedComponents: number;
  unchangedComponents: number;
  indexedAt: string;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class IndexRefreshManager {
  private readonly indexer = new ComponentIndexer();
  private readonly indices = new Map<string, ComponentIndex>();
  private readonly refreshIntervalMs: number;

  constructor(config: IndexRefreshConfig = {}) {
    this.refreshIntervalMs = config.refreshIntervalMs ?? 30 * 60 * 1000;
  }

  /**
   * Return the cached index for a repo, performing an incremental refresh
   * if the index is stale (older than refreshIntervalMs).
   *
   * If no index exists, performs a full initial index.
   */
  async getIndex(adapter: RepoAdapter, repoFullName: string): Promise<ComponentIndex> {
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
  async forceFullReIndex(adapter: RepoAdapter, repoFullName: string): Promise<ComponentIndex> {
    return this._fullIndex(adapter, repoFullName);
  }

  /**
   * Return cached index without refreshing. Returns undefined if not indexed.
   */
  getCached(repoFullName: string): ComponentIndex | undefined {
    return this.indices.get(repoFullName);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async _fullIndex(adapter: RepoAdapter, repoFullName: string): Promise<ComponentIndex> {
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

  private async _incrementalRefresh(
    adapter: RepoAdapter,
    repoFullName: string,
    previous: ComponentIndex
  ): Promise<ComponentIndex> {
    logger.info("index_refresh", { mode: "incremental", repoFullName });
    const [owner, repo] = repoFullName.split("/");
    const { meta } = await adapter.getRepoMeta(owner, repo);
    const { entries } = await adapter.getTree(owner, repo, meta.defaultBranch);
    const { updated, unchanged } = this.indexer.diff(previous, entries);

    // Merge: updated components replace previous; unchanged kept as-is
    const merged: ComponentDossier[] = [
      ...updated,
      ...unchanged,
    ];

    const index: ComponentIndex = {
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
