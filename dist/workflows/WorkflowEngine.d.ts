/**
 * WorkflowEngine — runs pipeline stages sequentially with AbortController support.
 */
export interface StageContext {
    runId: string;
    stages: string[];
    planMode: boolean;
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
export interface WorkflowRun {
    run_id: string;
    stages: string[];
    status: "running" | "completed" | "stopped" | "error";
    started_at: string;
    finished_at?: string;
    records_processed: number;
    error_count: number;
}
export interface WorkflowStage {
    name: string;
    run(ctx: StageContext, signal: AbortSignal): Promise<StageDiff>;
}
declare class WorkflowEngineImpl {
    private runs;
    plan(stages: string[]): Promise<PlanResult>;
    run(stages: string[]): Promise<string>;
    stop(run_id: string): boolean;
    listRuns(): WorkflowRun[];
    getRun(run_id: string): WorkflowRun | undefined;
}
export declare const WorkflowEngine: WorkflowEngineImpl;
export {};
