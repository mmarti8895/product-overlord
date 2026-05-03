/**
 * Roadmap types (UI mirror of src/types/roadmap.ts)
 */

export interface RICEScore {
  reach:        number;
  impact:       number;
  confidence:   number;
  effort:       number;
  score:        number;
  estimated_by: "llm" | "human";
}

export interface ICEScore {
  impact:       number;
  confidence:   number;
  ease:         number;
  score:        number;
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
  health_score:     number;
  health_label:     "healthy" | "at-risk" | "blocked";
  rice_score:       RICEScore | null;
  ice_score:        ICEScore | null;
  created_at:       string;
  updated_at:       string;
}

export interface Milestone {
  id:          string;
  name:        string;
  target_date: string;
  quarter:     string;
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
  project_key:      string;
  generated_at:     string;
  milestones:       Milestone[];
  epics:            Epic[];
  dependency_graph: DependencyEdge[];
  warnings:         string[];
}
