/**
 * RoadmapStore (roadmap-planning, task 2.4)
 *
 * In-process Map<projectKey, RoadmapSnapshot> cache.
 * Orchestrates EpicAggregator → PrioritisationEngine → DependencyGraphBuilder.
 * Persists snapshots to LanceDB table `roadmap_snapshots`.
 */
import type { RoadmapSnapshot, Epic, RICEScore, Milestone } from "../types/roadmap.js";
import type { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import type { LLMAdapter } from "../llm/types.js";
import type { CanonicalTicket } from "../types/index.js";
export declare class RoadmapStore {
    private readonly jira;
    private readonly llm;
    /** Map of projectKey → boardId (number) */
    private readonly projectBoardMap;
    /** Callback to load canonical tickets by epic key from LanceDB */
    private readonly loadChildTickets;
    private readonly cache;
    private readonly aggregator;
    private readonly prioritiser;
    private readonly depGraph;
    constructor(jira: JiraAgileRestAdapter, llm: LLMAdapter, 
    /** Map of projectKey → boardId (number) */
    projectBoardMap: Record<string, number>, 
    /** Callback to load canonical tickets by epic key from LanceDB */
    loadChildTickets: (epicKey: string) => Promise<CanonicalTicket[]>);
    getSnapshot(projectKey: string): RoadmapSnapshot | undefined;
    getMilestones(projectKey: string): Milestone[];
    refresh(projectKey: string): Promise<RoadmapSnapshot>;
    updateEpicRICE(epicKey: string, overrides: Partial<RICEScore>): Promise<Epic | null>;
}
