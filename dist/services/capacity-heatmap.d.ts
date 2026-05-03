/**
 * CapacityHeatmapBuilder — computes CapacityRow[] per team/project/week
 * from sprint snapshot data. (task 2.4)
 */
import type { RoadmapStore } from "../stores/roadmap-store.js";
import type { CapacityRow } from "../types/portfolio.js";
export declare class CapacityHeatmapBuilder {
    private readonly roadmapStore;
    /** sprintLengthDays default 14 */
    private readonly sprintLengthDays;
    constructor(roadmapStore: RoadmapStore, 
    /** sprintLengthDays default 14 */
    sprintLengthDays?: number);
    build(projectKeys: string[]): CapacityRow[];
}
