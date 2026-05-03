/**
 * Component Indexer
 *
 * Analyses a repo file tree to extract component-level dossiers:
 *   - component name
 *   - root paths
 *   - framework / runtime hints
 *   - owners (CODEOWNERS / OWNERS files)
 *   - test directories
 *   - coding conventions (presence of lint/format configs)
 *   - fix examples (recent changes — placeholder for history integration)
 *
 * The indexer is deterministic and works from the tree entries returned
 * by RepoAdapter.getTree(). It does not require file content fetches for
 * structure inference (only fetches CODEOWNERS when present).
 */
import type { RawTreeEntry } from "./repo-adapter.js";
export interface ComponentDossier {
    /** Inferred component name (usually the top-level directory or package name) */
    name: string;
    /** Root paths this component owns */
    rootPaths: string[];
    /** Detected frameworks / runtimes (e.g. "react", "express", "python") */
    frameworks: string[];
    /** Ownership hints from CODEOWNERS/OWNERS */
    owners: string[];
    /** Known test directory paths */
    testDirs: string[];
    /** Whether a test directory was found */
    testLocationKnown: boolean;
    /** Detected convention files (eslint, prettier, jest, etc.) */
    conventions: string[];
    /** Placeholder for historical fix examples (populated by enrichment layer) */
    fixExamples: FixExample[];
    /** ISO-8601 timestamp of last index */
    indexedAt: string;
}
export interface FixExample {
    /** PR/commit title */
    title: string;
    /** Affected paths */
    paths: string[];
    /** Summary of the change */
    summary: string;
}
export interface ComponentIndex {
    repoFullName: string;
    indexedAt: string;
    components: ComponentDossier[];
}
export declare class ComponentIndexer {
    /**
     * Build a ComponentIndex from a flat list of tree entries.
     * Groups entries by top-level directory → one component per directory.
     * Files at the repository root are grouped into a synthetic "<root>" component.
     */
    index(repoFullName: string, entries: RawTreeEntry[]): ComponentIndex;
    /**
     * Compute an incremental diff between two indices.
     * Returns only components where rootPaths changed (new or modified).
     */
    diff(previous: ComponentIndex, currentEntries: RawTreeEntry[]): {
        updated: ComponentDossier[];
        unchanged: ComponentDossier[];
    };
    private _buildDossier;
}
