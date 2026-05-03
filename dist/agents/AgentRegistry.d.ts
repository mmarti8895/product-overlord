/**
 * AgentRegistry — tracks active agents and their AbortControllers.
 */
export interface AgentRecord {
    name: string;
    run_id: string;
    started_at: string;
    parent_run_id?: string;
    controller: AbortController;
}
declare class AgentRegistryImpl {
    private byRunId;
    private byName;
    register(name: string, run_id: string, parent_run_id?: string): AbortController;
    deregister(run_id: string): void;
    stopRun(run_id: string): boolean;
    stopAgent(name: string): number;
    listAgents(): string[];
    listRuns(): AgentRecord[];
    getSignal(run_id: string): AbortSignal | undefined;
}
export declare const AgentRegistry: AgentRegistryImpl;
export {};
