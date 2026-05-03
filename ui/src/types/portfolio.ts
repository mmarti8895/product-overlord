/**
 * Portfolio types (UI mirror of src/types/portfolio.ts)
 */

export interface RoadmapHealthSummary {
  health_label:  "healthy" | "at-risk" | "blocked";
  epic_count:    number;
  blocked_count: number;
  next_milestone: string | null;
  next_milestone_date: string | null;
}

export interface ProjectSummary {
  project_key:     string;
  sprint_health:   "on-track" | "at-risk" | "off-track" | null;
  roadmap_health:  RoadmapHealthSummary | null;
  warnings:        string[];
}

export interface CapacityRow {
  project_key:          string;
  team:                 string;
  avg_velocity_6sp:     number;
  committed_next_ms:    number;
  sprints_to_milestone: number;
  utilisation_pct:      number;
  utilisation_label:    "under" | "ok" | "over";
  warnings:             string[];
}

export interface CrossProjectEdge {
  from_epic:   string;
  to_epic:     string;
  from_project: string;
  to_project:  string;
  type:        "blocks" | "depends-on";
  blocking:    boolean;
}

export interface DeliveryRecord {
  channel:    "slack" | "confluence";
  delivered:  boolean;
  url:        string | null;
  delivered_at: string;
  error:      string | null;
}

export interface PortfolioDigest {
  id:            string;
  portfolio_id:  string;
  content:       string;
  generated_at:  string;
  deliveries:    DeliveryRecord[];
}

export interface PortfolioSnapshot {
  id:              string;
  portfolio_id:    string;
  generated_at:    string;
  project_summaries: ProjectSummary[];
  cross_project_deps: CrossProjectEdge[];
  capacity_rows:   CapacityRow[];
  warnings:        string[];
}

export interface Portfolio {
  id:           string;
  name:         string;
  project_keys: string[];
  created_at:   string;
  updated_at:   string;
}
