/**
 * ScopeCreepDetector
 *
 * Detects tickets added to the sprint after sprint.startDate by comparing
 * issue `created` timestamps to the sprint start. Returns ScopeAddition[]
 * and the total delta in story points.
 */
export class ScopeCreepDetector {
    detect(issues, sprintStartDate) {
        const start = new Date(sprintStartDate).getTime();
        const additions = [];
        let delta = 0;
        for (const issue of issues) {
            const fields = issue.fields;
            // Primary: created timestamp
            const createdRaw = fields.created;
            if (!createdRaw || typeof createdRaw !== "string")
                continue;
            const created = new Date(createdRaw).getTime();
            if (isNaN(created))
                continue;
            // Only include issues created after the sprint started
            if (created <= start)
                continue;
            const points = this._resolvePoints(fields);
            delta += points;
            additions.push({
                key: issue.key,
                summary: String(fields.summary ?? ""),
                added_at: createdRaw,
                points,
            });
        }
        return { additions, delta };
    }
    _resolvePoints(fields) {
        for (const key of ["story_points", "customfield_10016", "storyPoints"]) {
            const v = fields[key];
            if (typeof v === "number" && !isNaN(v))
                return v;
        }
        const est = fields["original_estimate"] ?? fields["timeoriginalestimate"];
        if (typeof est === "number" && est > 0)
            return Math.round(est / 3600 / 8);
        return 0;
    }
}
