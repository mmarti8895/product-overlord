/**
 * AgentEventBus — singleton pub-sub bus for agent lifecycle events.
 * Keeps a ring buffer of the last RING_SIZE events for late-joining SSE clients.
 */
export type AgentEventKind = "start" | "progress" | "delay" | "finish" | "decision" | "finding";
export interface AgentEventBase {
    event: AgentEventKind;
    agent: string;
    run_id: string;
    ts: string;
}
export interface StartEvent extends AgentEventBase {
    event: "start";
    parent_run_id?: string;
}
export interface ProgressEvent extends AgentEventBase {
    event: "progress";
    pct: number;
    msg: string;
}
export interface DelayEvent extends AgentEventBase {
    event: "delay";
    reason: string;
    retry_in_ms: number;
}
export interface FinishEvent extends AgentEventBase {
    event: "finish";
    status: "ok" | "error" | "stopped";
    duration_ms: number;
}
export interface DecisionEvent extends AgentEventBase {
    event: "decision";
    decision_id: string;
}
export interface FindingEvent extends AgentEventBase {
    event: "finding";
    severity: "info" | "warn" | "critical";
    message: string;
    finding_id: string;
}
export type AgentEvent = StartEvent | ProgressEvent | DelayEvent | FinishEvent | DecisionEvent | FindingEvent;
type Subscriber = (event: AgentEvent) => void;
declare class AgentEventBusImpl {
    private ring;
    private subscribers;
    emit(event: AgentEvent): void;
    subscribe(fn: Subscriber): () => void;
    /** Returns a snapshot of recent events, optionally filtered by agent name. */
    replay(agentFilter?: string): AgentEvent[];
    /** Helper to build a typed event and emit it. */
    start(agent: string, run_id: string, parent_run_id?: string): void;
    progress(agent: string, run_id: string, pct: number, msg: string): void;
    delay(agent: string, run_id: string, reason: string, retry_in_ms: number): void;
    finish(agent: string, run_id: string, status: "ok" | "error" | "stopped", duration_ms: number): void;
    finding(agent: string, run_id: string, finding_id: string, severity: FindingEvent["severity"], message: string): void;
}
export declare const AgentEventBus: AgentEventBusImpl;
export {};
