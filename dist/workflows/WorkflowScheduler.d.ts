/**
 * WorkflowScheduler — wraps node-cron for persistent workflow schedules.
 */
export interface WorkflowSchedule {
    id: string;
    name: string;
    cron_expr: string;
    stages: string[];
    enabled: boolean;
    created_at: string;
    last_run?: string;
    next_run?: string;
}
declare class WorkflowSchedulerImpl {
    private schedules;
    private tasks;
    load(): void;
    private save;
    private startTask;
    upsert(data: Omit<WorkflowSchedule, "id" | "created_at">): WorkflowSchedule;
    delete(id: string): boolean;
    list(): WorkflowSchedule[];
}
export declare const WorkflowScheduler: WorkflowSchedulerImpl;
export {};
