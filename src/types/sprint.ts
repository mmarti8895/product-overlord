/**
 * Sprint monitoring types.
 *
 * These types are produced by SprintMonitor and its sub-services, and are
 * consumed by the /api/sprint/* routes and the SprintHealthPanel UI.
 */

// ---------------------------------------------------------------------------
// Velocity
// ---------------------------------------------------------------------------

export interface VelocityPoint {
  sprint_id: string;
  sprint_name: string;
  committed: number;
  completed: number;
}

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

export interface BlockerTicket {
  key: string;
  summary: string;
  /** Keys of the issues that are blocking this ticket */
  blocker_keys: string[];
  /** Calendar days the ticket has been in the active sprint without resolution */
  age_days: number;
}

// ---------------------------------------------------------------------------
// Scope creep
// ---------------------------------------------------------------------------

export interface ScopeAddition {
  key: string;
  summary: string;
  /** ISO-8601 — when the ticket was added to the sprint */
  added_at: string;
  /** Story points (or time-estimated equivalent) */
  points: number;
}

// ---------------------------------------------------------------------------
// Main snapshot
// ---------------------------------------------------------------------------

export interface SprintSnapshot {
  board_id: string;
  sprint_id: string;
  sprint_name: string;
  /** ISO-8601 — when this snapshot was built */
  fetched_at: string;
  start_date: string;
  end_date: string;
  days_remaining: number;

  // Velocity
  committed_points: number;
  completed_points: number;
  /** When story_points field is absent and we fell back to original_estimate */
  points_estimated_from_time: boolean;
  velocity_trend: VelocityPoint[];

  // Blockers
  blockers: BlockerTicket[];

  // Scope creep
  scope_additions: ScopeAddition[];
  /** Total story points added to the sprint after it started */
  scope_creep_delta: number;

  // Derived health
  health_score: number;
  health_label: "on-track" | "at-risk" | "off-track";

  // Staleness — set when the last Jira fetch failed
  stale?: boolean;
  stale_since?: string;
  warnings?: string[];
}
