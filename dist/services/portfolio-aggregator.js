/**
 * PortfolioAggregator — builds a full PortfolioSnapshot (task 2.5)
 */
export class PortfolioAggregator {
    portfolioStore;
    roadmapStore;
    depGraph;
    heatmap;
    constructor(portfolioStore, roadmapStore, depGraph, heatmap) {
        this.portfolioStore = portfolioStore;
        this.roadmapStore = roadmapStore;
        this.depGraph = depGraph;
        this.heatmap = heatmap;
    }
    async aggregate(portfolioId) {
        const portfolio = await this.portfolioStore.getPortfolio(portfolioId);
        if (!portfolio)
            throw new Error(`Portfolio ${portfolioId} not found`);
        const projectKeys = portfolio.project_keys;
        // ── Per-project summaries ────────────────────────────────────────────
        const projects = projectKeys.map((key) => {
            const snap = this.roadmapStore.getSnapshot(key);
            if (!snap) {
                return { project_key: key, name: key, health_score: 0, completed_epics: 0, total_epics: 0, at_risk_epics: 0, velocity_pct: 0 };
            }
            const total = snap.epics.length;
            const healthy = snap.epics.filter((e) => e.health_label === "healthy").length;
            const atRisk = snap.epics.filter((e) => e.health_label === "at-risk").length;
            const blocked = snap.epics.filter((e) => e.health_label === "blocked").length;
            const score = total > 0 ? Math.round(((healthy * 1 + atRisk * 0.5) / total) * 100) : 0;
            const velocityPct = total > 0 ? Math.round((healthy / total) * 100) : 0;
            return {
                project_key: key,
                name: key,
                health_score: score,
                completed_epics: healthy,
                total_epics: total,
                at_risk_epics: atRisk + blocked,
                velocity_pct: velocityPct,
            };
        });
        const dependencies = this.depGraph.build(projectKeys);
        const capacity_rows = this.heatmap.build(projectKeys);
        const snapshot = {
            portfolio_id: portfolioId,
            generated_at: new Date().toISOString(),
            projects,
            dependencies,
            capacity_rows,
            digest: null,
        };
        await this.portfolioStore.saveSnapshot(snapshot);
        return snapshot;
    }
}
