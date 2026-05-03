/**
 * DependencyGraphBuilder (roadmap-planning, task 2.3)
 *
 * Builds DependencyEdge[] from epic linked_epic_keys.
 * Detects cycles (DFS) and marks cross-team edges.
 */

import type { Epic, DependencyEdge } from "../types/roadmap.js";

export class DependencyGraphBuilder {
  build(epics: Epic[]): { edges: DependencyEdge[]; warnings: string[] } {
    const epicMap = new Map(epics.map(e => [e.key, e]));
    const edges: DependencyEdge[] = [];
    const warnings: string[] = [];

    for (const epic of epics) {
      for (const linkedKey of epic.linked_epic_keys) {
        const target = epicMap.get(linkedKey);
        edges.push({
          from_epic: epic.key,
          to_epic: linkedKey,
          type: "depends-on",
          cross_team: target ? target.project_key !== epic.project_key : false,
        });
      }
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (key: string, path: string[]): void => {
      if (stack.has(key)) {
        warnings.push(`cycle:${path.join("->")}→${key}`);
        return;
      }
      if (visited.has(key)) return;
      visited.add(key);
      stack.add(key);
      const epic = epicMap.get(key);
      if (epic) {
        for (const dep of epic.linked_epic_keys) {
          dfs(dep, [...path, key]);
        }
      }
      stack.delete(key);
    };

    for (const epic of epics) {
      if (!visited.has(epic.key)) dfs(epic.key, []);
    }

    return { edges, warnings };
  }
}
