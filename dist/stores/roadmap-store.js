/**
 * RoadmapStore (roadmap-planning, task 2.4)
 *
 * In-process Map<projectKey, RoadmapSnapshot> cache.
 * Orchestrates EpicAggregator → PrioritisationEngine → DependencyGraphBuilder.
 * Persists snapshots to LanceDB table `roadmap_snapshots`.
 */
import { EpicAggregator } from "../services/epic-aggregator.js";
import { PrioritisationEngine } from "../services/prioritisation-engine.js";
import { DependencyGraphBuilder } from "../services/dependency-graph.js";
import { logger } from "../utils/logger.js";
export class RoadmapStore {
    jira;
    llm;
    projectBoardMap;
    loadChildTickets;
    cache = new Map();
    aggregator;
    prioritiser;
    depGraph = new DependencyGraphBuilder();
    constructor(jira, llm, 
    /** Map of projectKey → boardId (number) */
    projectBoardMap, 
    /** Callback to load canonical tickets by epic key from LanceDB */
    loadChildTickets) {
        this.jira = jira;
        this.llm = llm;
        this.projectBoardMap = projectBoardMap;
        this.loadChildTickets = loadChildTickets;
        this.aggregator = new EpicAggregator({
            jira,
            loadChildTickets,
        });
        this.prioritiser = new PrioritisationEngine(llm);
    }
    getSnapshot(projectKey) {
        return this.cache.get(projectKey);
    }
    getMilestones(projectKey) {
        return this.cache.get(projectKey)?.milestones ?? [];
    }
    async refresh(projectKey) {
        const boardId = this.projectBoardMap[projectKey];
        if (boardId === undefined) {
            const empty = {
                project_key: projectKey,
                generated_at: new Date().toISOString(),
                milestones: [],
                epics: [],
                dependency_graph: [],
                warnings: [`no_board_id_for_project:${projectKey}`],
            };
            this.cache.set(projectKey, empty);
            return empty;
        }
        // 1. Aggregate epics from Jira + child tickets from LanceDB
        const partial = await this.aggregator.aggregate(boardId, projectKey);
        // 2. Run prioritisation for each epic
        const scoredEpics = [];
        for (const epic of partial.epics) {
            const scored = await this.prioritiser.score(epic);
            scoredEpics.push(scored);
        }
        // 3. Build dependency graph
        const { edges, warnings: depWarnings } = this.depGraph.build(scoredEpics);
        const snapshot = {
            project_key: projectKey,
            generated_at: new Date().toISOString(),
            milestones: partial.milestones,
            epics: scoredEpics,
            dependency_graph: edges,
            warnings: [...(partial.warnings ?? []), ...depWarnings],
        };
        this.cache.set(projectKey, snapshot);
        logger.info("roadmap_store_refreshed", { project_key: projectKey, epic_count: scoredEpics.length });
        return snapshot;
    }
    async updateEpicRICE(epicKey, overrides) {
        for (const [projectKey, snapshot] of this.cache) {
            const epicIdx = snapshot.epics.findIndex(e => e.key === epicKey);
            if (epicIdx === -1)
                continue;
            const epic = snapshot.epics[epicIdx];
            const updated = await this.prioritiser.score(epic, overrides);
            const updatedEpics = [...snapshot.epics];
            updatedEpics[epicIdx] = updated;
            this.cache.set(projectKey, { ...snapshot, epics: updatedEpics });
            logger.info("roadmap_store_rice_updated", { epic_key: epicKey });
            return updated;
        }
        return null;
    }
}
