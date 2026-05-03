/**
 * EpicAggregator (roadmap-planning, task 2.1)
 *
 * Fetches epics for a board, loads child CanonicalTicket records from
 * LanceDB, rolls up health scores, extracts milestone (fix-version) data,
 * and builds linked_epic_keys from cross-epic ticket dependency links.
 */
import type { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import type { RoadmapSnapshot } from "../types/roadmap.js";
import type { CanonicalTicket } from "../types/index.js";
export interface EpicAggregatorDeps {
    jira: JiraAgileRestAdapter;
    /** Load all canonical tickets that belong to a given epic key */
    loadChildTickets: (epicKey: string) => Promise<CanonicalTicket[]>;
}
export declare class EpicAggregator {
    private readonly deps;
    constructor(deps: EpicAggregatorDeps);
    aggregate(boardId: number, projectKey: string): Promise<Omit<RoadmapSnapshot, "dependency_graph">>;
}
