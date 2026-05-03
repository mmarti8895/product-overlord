/**
 * OrchestratorTeam — monitors AgentEventBus for thrashing, runaway tokens, and stalls.
 */
export type FindingSeverity = "info" | "warn" | "critical";
export interface OrchestratorFinding {
    id: string;
    agent: string;
    run_id: string;
    severity: FindingSeverity;
    type: "thrash" | "token_runaway" | "stall" | "other";
    message: string;
    created_at: string;
    status: "open" | "acked" | "escalated";
}
declare class OrchestratorTeamImpl {
    private findings;
    private eventCounts;
    private lastProgress;
    private tickInterval?;
    private unsubscribe?;
    start(): void;
    stop(): void;
    private handleEvent;
    private tick;
    private emitFinding;
    private persist;
    ack(id: string): OrchestratorFinding | null;
    escalate(id: string): OrchestratorFinding | null;
    list(status?: OrchestratorFinding["status"]): OrchestratorFinding[];
    get(id: string): OrchestratorFinding | undefined;
}
export declare const OrchestratorTeam: OrchestratorTeamImpl;
export {};
