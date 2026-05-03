/**
 * Sprint monitoring types — mirrored from src/types/sprint.ts for the UI.
 */

export interface VelocityPoint {
  sprint_id: string;
  sprint_name: string;
  committed: number;
  completed: number;
}

export interface BlockerTicket {
  key: string;
  summary: string;
  blocker_keys: string[];
  age_days: number;
}

export interface ScopeAddition {
  key: string;
  summary: string;
  added_at: string;
  points: number;
}

export interface SprintSnapshot {
  board_id: string;
  sprint_id: string;
  sprint_name: string;
  fetched_at: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  committed_points: number;
  completed_points: number;
  points_estimated_from_time: boolean;
  velocity_trend: VelocityPoint[];
  blockers: BlockerTicket[];
  scope_additions: ScopeAddition[];
  scope_creep_delta: number;
  health_score: number;
  health_label: "on-track" | "at-risk" | "off-track";
  stale: boolean;
  stale_since?: string;
  warnings?: string[];
}
