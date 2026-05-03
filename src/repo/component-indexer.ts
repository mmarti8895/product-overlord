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

// ---------------------------------------------------------------------------
// Component dossier
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Index result
// ---------------------------------------------------------------------------

export interface ComponentIndex {
  repoFullName: string;
  indexedAt: string;
  components: ComponentDossier[];
}

// ---------------------------------------------------------------------------
// Framework / runtime detection rules
// ---------------------------------------------------------------------------

const FRAMEWORK_SIGNALS: Array<{ pattern: RegExp; framework: string }> = [
  { pattern: /package\.json$/i, framework: "node" },
  { pattern: /requirements\.txt$|setup\.py$|pyproject\.toml$/i, framework: "python" },
  { pattern: /pom\.xml$|build\.gradle(\.kts)?$/i, framework: "java" },
  { pattern: /go\.mod$/i, framework: "go" },
  { pattern: /Cargo\.toml$/i, framework: "rust" },
  { pattern: /next\.config\.[jt]s$/i, framework: "nextjs" },
  { pattern: /vite\.config\.[jt]s$/i, framework: "vite" },
  { pattern: /angular\.json$/i, framework: "angular" },
  { pattern: /vue\.config\.[jt]s$/i, framework: "vue" },
  { pattern: /Gemfile$/i, framework: "ruby" },
  { pattern: /composer\.json$/i, framework: "php" },
];

const CONVENTION_SIGNALS = [
  /\.eslintrc/i,
  /\.prettierrc/i,
  /jest\.config/i,
  /vitest\.config/i,
  /\.editorconfig/i,
  /tsconfig\.json$/i,
];

const TEST_DIR_PATTERNS = [
  /\/__tests__\//,
  /\/tests?\//i,
  /\/spec\//i,
  /\/e2e\//i,
  /\/cypress\//i,
  /\/playwright\//i,
];

const OWNER_FILE_PATTERNS = [/CODEOWNERS$/i, /OWNERS$/i];

// ---------------------------------------------------------------------------
// Indexer
// ---------------------------------------------------------------------------

export class ComponentIndexer {
  /**
   * Build a ComponentIndex from a flat list of tree entries.
   * Groups entries by top-level directory → one component per directory.
   * Files at the repository root are grouped into a synthetic "<root>" component.
   */
  index(repoFullName: string, entries: RawTreeEntry[]): ComponentIndex {
    const indexedAt = new Date().toISOString();
    const byTopDir = new Map<string, RawTreeEntry[]>();

    for (const entry of entries) {
      const parts = entry.path.split("/");
      const topDir = parts.length > 1 ? parts[0] : "<root>";
      if (!byTopDir.has(topDir)) byTopDir.set(topDir, []);
      byTopDir.get(topDir)!.push(entry);
    }

    const components: ComponentDossier[] = [];
    for (const [dir, dirEntries] of byTopDir) {
      components.push(this._buildDossier(dir, dirEntries, indexedAt));
    }

    return { repoFullName, indexedAt, components };
  }

  /**
   * Compute an incremental diff between two indices.
   * Returns only components where rootPaths changed (new or modified).
   */
  diff(
    previous: ComponentIndex,
    currentEntries: RawTreeEntry[]
  ): { updated: ComponentDossier[]; unchanged: ComponentDossier[] } {
    const fresh = this.index(previous.repoFullName, currentEntries);
    const prevMap = new Map(previous.components.map((c) => [c.name, c]));

    const updated: ComponentDossier[] = [];
    const unchanged: ComponentDossier[] = [];

    for (const comp of fresh.components) {
      const prev = prevMap.get(comp.name);
      if (!prev) {
        updated.push(comp);
        continue;
      }
      // Compare root path sets
      const prevPaths = new Set(prev.rootPaths);
      const changed = comp.rootPaths.some((p) => !prevPaths.has(p)) ||
        prev.rootPaths.some((p) => !comp.rootPaths.includes(p));
      if (changed) {
        updated.push(comp);
      } else {
        unchanged.push(prev);
      }
    }

    return { updated, unchanged };
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private _buildDossier(
    dirName: string,
    entries: RawTreeEntry[],
    indexedAt: string
  ): ComponentDossier {
    const paths = entries.map((e) => e.path);
    const frameworks = new Set<string>();
    const conventions: string[] = [];
    const testDirs: string[] = [];
    const owners: string[] = [];

    for (const path of paths) {
      // Framework detection
      for (const sig of FRAMEWORK_SIGNALS) {
        if (sig.pattern.test(path) && !frameworks.has(sig.framework)) {
          frameworks.add(sig.framework);
        }
      }

      // Convention files
      if (CONVENTION_SIGNALS.some((p) => p.test(path))) {
        conventions.push(path);
      }

      // Test directories
      if (TEST_DIR_PATTERNS.some((p) => p.test("/" + path))) {
        const testDir = path.split("/").slice(0, -1).join("/");
        if (testDir && !testDirs.includes(testDir)) {
          testDirs.push(testDir);
        }
      }

      // Owner files (content fetched separately by enrichment layer)
      if (OWNER_FILE_PATTERNS.some((p) => p.test(path))) {
        owners.push(path); // store path; content resolved by TeamworkGraph enrichment
      }
    }

    return {
      name: dirName,
      rootPaths: paths,
      frameworks: [...frameworks],
      owners,
      testDirs,
      testLocationKnown: testDirs.length > 0,
      conventions,
      fixExamples: [],
      indexedAt,
    };
  }
}
