// Shared types used across all adapters and the canonical ticket model

export type IssueType = "story" | "bug" | "task" | string;
export type ReadinessStatus = "ready" | "needs_clarification" | "blocked";
export type AdapterName = "rovo-mcp" | "jira-agile-rest" | "repo-adapter";
export type Severity = "high" | "medium" | "low";
export type Persona = "pm" | "engineer" | "qa";

export interface AdapterTrace {
  adapter: AdapterName;
  operation: string;
  statusCode?: number;
  latencyMs: number;
  retryCount: number;
  error?: string;
  degraded?: boolean;
}

export interface LinkedArtifact {
  key: string;
  relationship: string;
  url?: string;
}

export interface Dependency {
  key: string;
  relationship: string;
  status?: string;
}

export interface CanonicalTicket {
  ticket_key: string;
  ticket_type: IssueType;
  summary: string;
  description: string;
  acceptance_criteria: string | null;
  ac_field_source: string | null;
  issue_type: string;
  status: string;
  labels: string[];
  priority: string;
  reporter: string;
  assignee: string | null;
  linked_artifacts: LinkedArtifact[];
  dependencies: Dependency[];
  comments: string[];
  board_id: string | null;
  sprint_id: string | null;
  /** Epic this ticket belongs to (roadmap-planning) */
  epic_key: string | null;
  /** Jira fix-versions (roadmap-planning) */
  fix_versions: string[];
  raw_fields: Record<string, unknown>;
}

export interface MissingItem {
  dimension: string;
  severity: Severity;
  reason: string;
  /** "llm" when this item was added by LLM enrichment; absent for deterministic items */
  source?: "llm";
}

export interface ClarificationQuestion {
  persona: Persona;
  question: string;
  /** LLM-supplied justification citing specific context */
  justification?: string;
}

export interface ReadinessResult {
  ticket_key: string;
  ticket_type: IssueType;
  readiness_status: ReadinessStatus;
  readiness_score: number;
  missing_items: MissingItem[];
  questions_for_pm: string[];
  questions_for_engineer: string[];
  questions_for_qa: string[];
  manual_checks: string[];
  confidence: number;
  explanation: string;
  evidence: string[];
}

export interface CommentDraft {
  run_id: string;
  ticket_key: string;
  body: string;
  confirm_post_url: string;
}

// ---------------------------------------------------------------------------
// Stage-2: Repo mapping & action package
// ---------------------------------------------------------------------------

export interface CandidateComponent {
  name: string;
  confidence: number; // 0.0–1.0
  why: string;
}

export interface CandidateFile {
  path: string;
  reason: string;
}

export interface CandidateTest {
  path: string;
  reason: string;
}

export interface RepoMapResult {
  ticket_key: string;
  candidate_components: CandidateComponent[];
  candidate_files: CandidateFile[];
  candidate_tests: CandidateTest[];
  low_confidence: boolean;
  test_location_unknown: boolean;
  enrichment_source?: "teamwork_graph" | "structural_only" | "unavailable";
  evidence: string[];
}

export interface ActionPackageConflict {
  reason: string;
  readiness_status: ReadinessStatus;
  repo_map_confidence: number;
}

export interface ActionPackage {
  ticket_key: string;
  readiness_status: ReadinessStatus;
  readiness_score: number;
  candidate_components: CandidateComponent[];
  candidate_files: CandidateFile[];
  candidate_tests: CandidateTest[];
  branch_name_suggestion: string;
  openspec_change_slug: string;
  operational_risks: string[];
  manual_checks: string[];
  repo_map_confidence: number;
  low_confidence: boolean;
  conflict: ActionPackageConflict | null;
  evidence: string[];
}

export interface ReviewerVerdict {
  approved: boolean;
  reasons: string[];
}
