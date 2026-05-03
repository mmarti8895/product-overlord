/**
 * BlockerDetector
 *
 * Filters active sprint issues that have unresolved "is blocked by" links
 * AND are past the sprint midpoint. Returns BlockerTicket[] sorted by
 * age_days descending.
 */
import type { BlockerTicket } from "../types/sprint.js";
export interface SprintWindow {
    startDate: string;
    endDate: string;
}
export declare class BlockerDetector {
    private readonly doneStatuses;
    constructor(doneStatuses: string[]);
    detect(issues: Array<{
        key: string;
        fields: Record<string, unknown>;
    }>, sprint: SprintWindow): BlockerTicket[];
    private _isDone;
}
