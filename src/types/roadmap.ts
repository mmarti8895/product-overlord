/**
 * Roadmap Planning types (roadmap-planning change)
 */

export interface RICEScore {
  reach:        number;   // estimated users impacted 0–1000
  impact:       number;   // 0.25 | 0.5 | 1 | 2 | 3
  confidence:   number;   // percentage 0–100
  effort:       number;   // person-weeks
  score:        number;   // reach * impact * confidence / effort
  estimated_by: "llm" | "human";
}

export interface ICEScore {
  impact:       number;   // 1–10
  confidence:   number;   // 1–10
  ease:         number;   // 1–10
  score:        number;   // impact * confidence * ease
  estimated_by: "llm" | "human";
}

export interface Epic {
  key:              string;
  summary:          string;
  description:      string | null;
  status:           string;
  project_key:      string;
  milestone_id:     string | null;
  child_keys:       string[];
  linked_epic_keys: string[];
  health_score:     number;   // 0–100
  health_label:     "healthy" | "at-risk" | "blocked";
  rice_score:       RICEScore | null;
  ice_score:        ICEScore | null;
  created_at:       string;
  updated_at:       string;
}

export interface Milestone {
  id:          string;
  name:        string;
  target_date: string;   // ISO-8601 date
  quarter:     string;   // e.g. "Q3-2026"
  project_key: string;
  epic_keys:   string[];
  status:      "planned" | "in-progress" | "shipped" | "delayed";
}

export interface DependencyEdge {
  from_epic:  string;
  to_epic:    string;
  type:       "blocks" | "depends-on";
  cross_team: boolean;
}

export interface RoadmapSnapshot {
  project_key:       string;
  generated_at:      string;
  milestones:        Milestone[];
  epics:             Epic[];
  dependency_graph:  DependencyEdge[];
  warnings:          string[];
}
