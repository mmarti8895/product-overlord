/**
 * BlockerDetector
 *
 * Filters active sprint issues that have unresolved "is blocked by" links
 * AND are past the sprint midpoint. Returns BlockerTicket[] sorted by
 * age_days descending.
 */
export class BlockerDetector {
    doneStatuses;
    constructor(doneStatuses) {
        this.doneStatuses = doneStatuses;
    }
    detect(issues, sprint) {
        const start = new Date(sprint.startDate).getTime();
        const end = new Date(sprint.endDate).getTime();
        const midpoint = (start + end) / 2;
        const now = Date.now();
        if (now <= midpoint)
            return []; // only flag past midpoint
        const blockers = [];
        for (const issue of issues) {
            const fields = issue.fields;
            const status = fields.status?.name ?? "";
            // Skip done issues
            if (this._isDone(status))
                continue;
            const links = fields.issuelinks ?? [];
            const blockerKeys = [];
            for (const link of links) {
                const inward = link.type?.inward?.toLowerCase() ?? "";
                if (inward.includes("is blocked by") || inward.includes("blocked by")) {
                    const blockingStatus = link.inwardIssue?.fields?.status?.name ?? "";
                    if (!this._isDone(blockingStatus)) {
                        const key = link.inwardIssue?.key;
                        if (key)
                            blockerKeys.push(key);
                    }
                }
            }
            if (blockerKeys.length === 0)
                continue;
            const created = fields.created ? new Date(fields.created).getTime() : start;
            const ageDays = Math.max(0, Math.floor((now - created) / 86_400_000));
            blockers.push({
                key: issue.key,
                summary: fields.summary ?? "",
                blocker_keys: blockerKeys,
                age_days: ageDays,
            });
        }
        return blockers.sort((a, b) => b.age_days - a.age_days);
    }
    _isDone(status) {
        return this.doneStatuses.some(d => d.toLowerCase() === status.toLowerCase());
    }
}
