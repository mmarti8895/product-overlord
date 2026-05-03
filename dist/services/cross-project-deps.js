/**
 * CrossProjectDependencyGraph — builds CrossProjectEdge[] from per-project
 * RoadmapSnapshots. (task 2.3)
 */
export class CrossProjectDependencyGraph {
    roadmapStore;
    constructor(roadmapStore) {
        this.roadmapStore = roadmapStore;
    }
    build(projectKeys) {
        const edges = [];
        for (const key of projectKeys) {
            const snap = this.roadmapStore.getSnapshot(key);
            if (!snap)
                continue;
            for (const dep of snap.dependency_graph) {
                // Check if the target epic belongs to a different project
                const fromProject = key;
                const toProject = this.findProjectForEpic(dep.to_epic, projectKeys);
                if (!toProject || toProject === fromProject)
                    continue;
                edges.push({
                    from_project: fromProject,
                    to_project: toProject,
                    type: dep.type,
                    epic_from: dep.from_epic,
                    epic_to: dep.to_epic,
                    cross_team: dep.cross_team,
                });
            }
        }
        return edges;
    }
    findProjectForEpic(epicKey, projectKeys) {
        for (const key of projectKeys) {
            const snap = this.roadmapStore.getSnapshot(key);
            if (!snap)
                continue;
            if (snap.epics.some((e) => e.key === epicKey))
                return key;
        }
        return null;
    }
}
