/**
 * VelocityTracker
 *
 * Fetches the last N closed sprints for a board and returns a VelocityPoint[]
 * sorted oldest → newest. Uses story_points; falls back to original_estimate
 * (hours ÷ 8) when story_points is absent.
 */
import { logger } from "../utils/logger.js";
const DEFAULT_LOOKBACK = 6;
export class VelocityTracker {
    jira;
    doneStatuses;
    constructor(jira, doneStatuses) {
        this.jira = jira;
        this.doneStatuses = doneStatuses;
    }
    async getVelocity(boardId, lookback = DEFAULT_LOOKBACK) {
        const { sprints } = await this.jira.listSprints(boardId, {
            state: "closed",
            maxResults: lookback,
        });
        if (sprints.length === 0)
            return [];
        const points = [];
        for (const sprint of sprints) {
            try {
                const { issues } = await this.jira.getSprintIssues(sprint.id, { maxResults: 200 });
                let committed = 0;
                let completed = 0;
                for (const issue of issues) {
                    const fields = issue.fields;
                    const sp = this._resolvePoints(fields);
                    committed += sp;
                    const status = String(fields.status?.name ?? "");
                    if (this.doneStatuses.some(d => d.toLowerCase() === status.toLowerCase())) {
                        completed += sp;
                    }
                }
                points.push({
                    sprint_id: String(sprint.id),
                    sprint_name: sprint.name,
                    committed,
                    completed,
                });
            }
            catch (err) {
                logger.warn("velocity_tracker_sprint_error", {
                    board_id: boardId,
                    sprint_id: sprint.id,
                    error: String(err),
                });
            }
        }
        // Return oldest → newest (API returns newest first)
        return points.reverse();
    }
    _resolvePoints(fields) {
        // Try story_points (customfield_10016 is Jira's default story-points field)
        for (const key of ["story_points", "customfield_10016", "storyPoints"]) {
            const v = fields[key];
            if (typeof v === "number" && !isNaN(v))
                return v;
        }
        // Fallback: original_estimate in seconds → hours ÷ 8
        const est = fields["original_estimate"] ?? (fields["timeoriginalestimate"]);
        if (typeof est === "number" && est > 0)
            return Math.round(est / 3600 / 8);
        return 0;
    }
}
