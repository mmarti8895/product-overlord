/**
 * CapacityHeatmapBuilder — computes CapacityRow[] per team/project/week
 * from sprint snapshot data. (task 2.4)
 */
function isoWeek(dateStr) {
    const d = new Date(dateStr);
    // ISO week: YYYY-WW
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diff = d.getTime() - startOfWeek1.getTime();
    const week = Math.ceil((diff / 86400000 + 1) / 7);
    return `${d.getFullYear()}-${String(week).padStart(2, "0")}`;
}
export class CapacityHeatmapBuilder {
    roadmapStore;
    sprintLengthDays;
    constructor(roadmapStore, 
    /** sprintLengthDays default 14 */
    sprintLengthDays = 14) {
        this.roadmapStore = roadmapStore;
        this.sprintLengthDays = sprintLengthDays;
    }
    build(projectKeys) {
        const rows = [];
        for (const projectKey of projectKeys) {
            const snap = this.roadmapStore.getSnapshot(projectKey);
            if (!snap)
                continue;
            // Use epic milestones as proxy for sprints
            for (const milestone of snap.milestones) {
                const week = isoWeek(milestone.target_date);
                const epicsInMilestone = snap.epics.filter((e) => e.milestone_id === milestone.id);
                const allocatedPoints = epicsInMilestone.reduce((s, e) => s + e.child_keys.length * 3, 0);
                const completedPoints = epicsInMilestone
                    .filter((e) => e.health_label === "healthy")
                    .reduce((s, e) => s + e.child_keys.length * 3, 0);
                const utilisationPct = allocatedPoints > 0
                    ? Math.min(100, Math.round((completedPoints / allocatedPoints) * 100))
                    : 0;
                rows.push({
                    team: projectKey,
                    project_key: projectKey,
                    sprint_week: week,
                    allocated_points: allocatedPoints,
                    completed_points: completedPoints,
                    utilisation_pct: utilisationPct,
                });
            }
        }
        return rows;
    }
}
