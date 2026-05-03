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
import { EpicAggregator } from "../services/epic-aggregator.js";
import { PrioritisationEngine } from "../services/prioritisation-engine.js";
import { DependencyGraphBuilder } from "../services/dependency-graph.js";
import { logger } from "../utils/logger.js";

export class RoadmapStore {
  private readonly cache = new Map<string, RoadmapSnapshot>();
  private readonly aggregator: EpicAggregator;
  private readonly prioritiser: PrioritisationEngine;
  private readonly depGraph = new DependencyGraphBuilder();

  constructor(
    private readonly jira: JiraAgileRestAdapter,
    private readonly llm: LLMAdapter,
    /** Map of projectKey → boardId (number) */
    private readonly projectBoardMap: Record<string, number>,
    /** Callback to load canonical tickets by epic key from LanceDB */
    private readonly loadChildTickets: (epicKey: string) => Promise<CanonicalTicket[]>,
  ) {
    this.aggregator = new EpicAggregator({
      jira,
      loadChildTickets,
    });
    this.prioritiser = new PrioritisationEngine(llm);
  }

  getSnapshot(projectKey: string): RoadmapSnapshot | undefined {
    return this.cache.get(projectKey);
  }

  getMilestones(projectKey: string): Milestone[] {
    return this.cache.get(projectKey)?.milestones ?? [];
  }

  async refresh(projectKey: string): Promise<RoadmapSnapshot> {
    const boardId = this.projectBoardMap[projectKey];
    if (boardId === undefined) {
      const empty: RoadmapSnapshot = {
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
    const scoredEpics: Epic[] = [];
    for (const epic of partial.epics) {
      const scored = await this.prioritiser.score(epic);
      scoredEpics.push(scored);
    }

    // 3. Build dependency graph
    const { edges, warnings: depWarnings } = this.depGraph.build(scoredEpics);

    const snapshot: RoadmapSnapshot = {
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

  async updateEpicRICE(epicKey: string, overrides: Partial<RICEScore>): Promise<Epic | null> {
    for (const [projectKey, snapshot] of this.cache) {
      const epicIdx = snapshot.epics.findIndex(e => e.key === epicKey);
      if (epicIdx === -1) continue;

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
