/**
 * Portfolio-management domain types (portfolio-management task 1.1)
 */
export interface ProjectSummary {
    project_key: string;
    name: string;
    health_score: number;
    completed_epics: number;
    total_epics: number;
    at_risk_epics: number;
    velocity_pct: number;
}
export interface CrossProjectEdge {
    from_project: string;
    to_project: string;
    type: "depends_on" | "blocks" | "related";
    epic_from: string;
    epic_to: string;
    cross_team: boolean;
}
export interface CapacityRow {
    team: string;
    project_key: string;
    sprint_week: string;
    allocated_points: number;
    completed_points: number;
    utilisation_pct: number;
}
export interface Portfolio {
    id: string;
    name: string;
    project_keys: string[];
    owner: string | null;
    created_at: string;
}
export interface DeliveryRecord {
    id: string;
    portfolio_id: string;
    channel: "slack" | "confluence";
    delivered_at: string;
    success: boolean;
    error: string | null;
}
export interface PortfolioDigest {
    portfolio_id: string;
    generated_at: string;
    markdown: string;
    projects: ProjectSummary[];
}
export interface PortfolioSnapshot {
    portfolio_id: string;
    generated_at: string;
    projects: ProjectSummary[];
    dependencies: CrossProjectEdge[];
    capacity_rows: CapacityRow[];
    digest: PortfolioDigest | null;
}
