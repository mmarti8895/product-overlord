/**
 * ScopeCreepDetector
 *
 * Detects tickets added to the sprint after sprint.startDate by comparing
 * issue `created` timestamps to the sprint start. Returns ScopeAddition[]
 * and the total delta in story points.
 */
import type { ScopeAddition } from "../types/sprint.js";
export declare class ScopeCreepDetector {
    detect(issues: Array<{
        key: string;
        fields: Record<string, unknown>;
    }>, sprintStartDate: string): {
        additions: ScopeAddition[];
        delta: number;
    };
    private _resolvePoints;
}
