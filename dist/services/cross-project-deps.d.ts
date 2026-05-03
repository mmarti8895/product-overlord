/**
 * CrossProjectDependencyGraph — builds CrossProjectEdge[] from per-project
 * RoadmapSnapshots. (task 2.3)
 */
import type { RoadmapStore } from "../stores/roadmap-store.js";
import type { CrossProjectEdge } from "../types/portfolio.js";
export declare class CrossProjectDependencyGraph {
    private readonly roadmapStore;
    constructor(roadmapStore: RoadmapStore);
    build(projectKeys: string[]): CrossProjectEdge[];
    private findProjectForEpic;
}
