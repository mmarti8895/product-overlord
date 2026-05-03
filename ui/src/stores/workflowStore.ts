import { create } from "zustand";

export interface WorkflowRun {
  run_id: string;
  stages: string[];
  status: "running" | "completed" | "stopped" | "error";
  started_at: string;
  finished_at?: string;
  records_processed: number;
  error_count: number;
}

export interface WorkflowSchedule {
  id: string;
  name: string;
  cron_expr: string;
  stages: string[];
  enabled: boolean;
  created_at: string;
  last_run?: string;
}

export interface StageDiff {
  name: string;
  records: number;
  new: number;
  updated: number;
  unchanged: number;
  token_estimate: number;
}

export interface PlanResult {
  stages: StageDiff[];
  estimated_tokens: number;
  estimated_cost_usd: number;
}

interface WorkflowState {
  runs: WorkflowRun[];
  schedules: WorkflowSchedule[];
  planResult: PlanResult | null;
  selectedStages: string[];
  setRuns: (runs: WorkflowRun[]) => void;
  setSchedules: (s: WorkflowSchedule[]) => void;
  setPlanResult: (r: PlanResult | null) => void;
  setSelectedStages: (stages: string[]) => void;
}

export const DEFAULT_STAGES = [
  "crawl-docs", "crawl-jira", "crawl-github",
  "normalise", "enrich", "embed", "upsert-lancedb",
];

export const useWorkflowStore = create<WorkflowState>((set) => ({
  runs: [],
  schedules: [],
  planResult: null,
  selectedStages: [...DEFAULT_STAGES],
  setRuns: (runs) => set({ runs }),
  setSchedules: (schedules) => set({ schedules }),
  setPlanResult: (planResult) => set({ planResult }),
  setSelectedStages: (selectedStages) => set({ selectedStages }),
}));
