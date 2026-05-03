/**
 * DependencyGraphBuilder (roadmap-planning, task 2.3)
 *
 * Builds DependencyEdge[] from epic linked_epic_keys.
 * Detects cycles (DFS) and marks cross-team edges.
 */
import type { Epic, DependencyEdge } from "../types/roadmap.js";
export declare class DependencyGraphBuilder {
    build(epics: Epic[]): {
        edges: DependencyEdge[];
        warnings: string[];
    };
}
