/**
 * EpicAggregator (roadmap-planning, task 2.1)
 *
 * Fetches epics for a board, loads child CanonicalTicket records from
 * LanceDB, rolls up health scores, extracts milestone (fix-version) data,
 * and builds linked_epic_keys from cross-epic ticket dependency links.
 */
import { logger } from "../utils/logger.js";
function deriveHealthLabel(score) {
    if (score >= 70)
        return "healthy";
    if (score >= 40)
        return "at-risk";
    return "blocked";
}
export class EpicAggregator {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async aggregate(boardId, projectKey) {
        const warnings = [];
        const now = new Date().toISOString();
        let rawEpics;
        try {
            const result = await this.deps.jira.getEpicsForBoard(boardId);
            rawEpics = result.epics;
        }
        catch (err) {
            logger.error("epic_aggregator_fetch_failed", { board_id: boardId, error: String(err) });
            warnings.push("no_epics_found");
            return { project_key: projectKey, generated_at: now, milestones: [], epics: [], warnings };
        }
        if (rawEpics.length === 0) {
            warnings.push("no_epics_found");
            return { project_key: projectKey, generated_at: now, milestones: [], epics: [], warnings };
        }
        const milestoneMap = new Map();
        const epics = [];
        for (const raw of rawEpics) {
            let children = [];
            try {
                children = await this.deps.loadChildTickets(raw.key);
            }
            catch (err) {
                logger.warn("epic_aggregator_children_failed", { epic_key: raw.key, error: String(err) });
                warnings.push(`children_load_failed:${raw.key}`);
            }
            // Health score: mean(children.readiness_score) * 100, default 50 if no children
            let healthScore = 50;
            if (children.length > 0) {
                const mean = children.reduce((s, c) => s + (c.readiness_score ?? 0), 0) / children.length;
                healthScore = Math.round(mean * 100);
            }
            else {
                warnings.push(`no_child_tickets:${raw.key}`);
            }
            // linked_epic_keys from cross-epic ticket dependency links
            const linkedSet = new Set();
            for (const child of children) {
                for (const dep of child.dependencies ?? []) {
                    // If dependency key looks like an epic (uppercase letters + dash + number, no subtask suffix)
                    if (dep.key && dep.key !== raw.key && /^[A-Z]+-\d+$/.test(dep.key)) {
                        linkedSet.add(dep.key);
                    }
                }
            }
            // Milestones from fix_versions
            for (const child of children) {
                for (const version of child.fix_versions ?? []) {
                    if (!milestoneMap.has(version)) {
                        milestoneMap.set(version, {
                            id: version,
                            name: version,
                            target_date: now.slice(0, 10),
                            quarter: _quarterFromDate(now),
                            project_key: projectKey,
                            epic_keys: [],
                            status: "planned",
                        });
                    }
                    const ms = milestoneMap.get(version);
                    if (!ms.epic_keys.includes(raw.key))
                        ms.epic_keys.push(raw.key);
                }
            }
            epics.push({
                key: raw.key,
                summary: raw.summary ?? raw.name,
                description: null,
                status: raw.done ? "Done" : "In Progress",
                project_key: projectKey,
                milestone_id: null,
                child_keys: children.map(c => c.ticket_key),
                linked_epic_keys: Array.from(linkedSet),
                health_score: healthScore,
                health_label: deriveHealthLabel(healthScore),
                rice_score: null,
                ice_score: null,
                created_at: now,
                updated_at: now,
            });
        }
        return {
            project_key: projectKey,
            generated_at: now,
            milestones: Array.from(milestoneMap.values()),
            epics,
            warnings,
        };
    }
}
function _quarterFromDate(isoDate) {
    const d = new Date(isoDate);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `Q${q}-${d.getFullYear()}`;
}
