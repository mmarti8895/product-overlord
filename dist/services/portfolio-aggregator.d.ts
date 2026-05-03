/**
 * PortfolioAggregator — builds a full PortfolioSnapshot (task 2.5)
 */
import type { PortfolioStore } from "../stores/portfolio-store.js";
import type { RoadmapStore } from "../stores/roadmap-store.js";
import type { CrossProjectDependencyGraph } from "./cross-project-deps.js";
import type { CapacityHeatmapBuilder } from "./capacity-heatmap.js";
import type { PortfolioSnapshot } from "../types/portfolio.js";
export declare class PortfolioAggregator {
    private readonly portfolioStore;
    private readonly roadmapStore;
    private readonly depGraph;
    private readonly heatmap;
    constructor(portfolioStore: PortfolioStore, roadmapStore: RoadmapStore, depGraph: CrossProjectDependencyGraph, heatmap: CapacityHeatmapBuilder);
    aggregate(portfolioId: string): Promise<PortfolioSnapshot>;
}
