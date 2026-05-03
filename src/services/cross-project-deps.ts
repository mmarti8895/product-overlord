/**
 * CrossProjectDependencyGraph — builds CrossProjectEdge[] from per-project
 * RoadmapSnapshots. (task 2.3)
 */

import type { RoadmapStore } from "../stores/roadmap-store.js";
import type { CrossProjectEdge } from "../types/portfolio.js";

export class CrossProjectDependencyGraph {
  constructor(private readonly roadmapStore: RoadmapStore) {}

  build(projectKeys: string[]): CrossProjectEdge[] {
    const edges: CrossProjectEdge[] = [];

    for (const key of projectKeys) {
      const snap = this.roadmapStore.getSnapshot(key);
      if (!snap) continue;

      for (const dep of snap.dependency_graph) {
        // Check if the target epic belongs to a different project
        const fromProject = key;
        const toProject = this.findProjectForEpic(dep.to_epic, projectKeys);
        if (!toProject || toProject === fromProject) continue;

        edges.push({
          from_project: fromProject,
          to_project:   toProject,
          type:         dep.type as CrossProjectEdge["type"],
          epic_from:    dep.from_epic,
          epic_to:      dep.to_epic,
          cross_team:   dep.cross_team,
        });
      }
    }

    return edges;
  }

  private findProjectForEpic(epicKey: string, projectKeys: string[]): string | null {
    for (const key of projectKeys) {
      const snap = this.roadmapStore.getSnapshot(key);
      if (!snap) continue;
      if (snap.epics.some((e) => e.key === epicKey)) return key;
    }
    return null;
  }
}
