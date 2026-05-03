/**
 * SprintMonitor
 *
 * Background service that polls configured Jira boards on a fixed interval,
 * derives health metrics, caches SprintSnapshot per board, and emits
 * `sprint:snapshot-updated` on AgentEventBus.
 *
 * Health score formula (tasks 2.5, 2.6):
 *   health_score = clamp(100
 *     - (blockers.length * 10)
 *     - (scope_creep_delta * 2)
 *     - (completedRatio < 0.5 && daysRemaining < 3 ? 30 : 0)
 *   , 0, 100)
 *
 *   health_label:
 *     >= 75 → "on-track"
 *     >= 40 → "at-risk"
 *     <  40 → "off-track"
 */
import type { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import type { SprintSnapshot } from "../types/sprint.js";
import type { SprintConfig } from "../server/config.js";
export declare class SprintMonitor {
    private readonly jira;
    private readonly cfg;
    private readonly cache;
    private timer;
    private readonly velocity;
    private readonly blockerDetector;
    private readonly scopeDetector;
    constructor(jira: JiraAgileRestAdapter, cfg: SprintConfig);
    start(): void;
    stop(): void;
    getSnapshot(boardId: string): SprintSnapshot | undefined;
    getAllSnapshots(): SprintSnapshot[];
    private _pollAll;
    _pollBoard(boardId: string): Promise<void>;
    private _resolvePoints;
}
