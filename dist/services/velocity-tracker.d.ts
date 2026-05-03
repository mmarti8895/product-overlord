/**
 * VelocityTracker
 *
 * Fetches the last N closed sprints for a board and returns a VelocityPoint[]
 * sorted oldest → newest. Uses story_points; falls back to original_estimate
 * (hours ÷ 8) when story_points is absent.
 */
import type { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import type { VelocityPoint } from "../types/sprint.js";
export declare class VelocityTracker {
    private readonly jira;
    private readonly doneStatuses;
    constructor(jira: JiraAgileRestAdapter, doneStatuses: string[]);
    getVelocity(boardId: number, lookback?: number): Promise<VelocityPoint[]>;
    private _resolvePoints;
}
