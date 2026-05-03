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

export interface StartEvent extends AgentEventBase { event: "start"; parent_run_id?: string }
export interface ProgressEvent extends AgentEventBase { event: "progress"; pct: number; msg: string }
export interface DelayEvent extends AgentEventBase { event: "delay"; reason: string; retry_in_ms: number }
export interface FinishEvent extends AgentEventBase { event: "finish"; status: "ok" | "error" | "stopped"; duration_ms: number }
export interface DecisionEvent extends AgentEventBase { event: "decision"; decision_id: string }
export interface FindingEvent extends AgentEventBase { event: "finding"; severity: "info" | "warn" | "critical"; message: string; finding_id: string }

export type AgentEvent =
  | StartEvent | ProgressEvent | DelayEvent | FinishEvent | DecisionEvent | FindingEvent;

type Subscriber = (event: AgentEvent) => void;

const RING_SIZE = 2000;

class AgentEventBusImpl {
  private ring: AgentEvent[] = [];
  private subscribers: Set<Subscriber> = new Set();

  emit(event: AgentEvent): void {
    if (this.ring.length >= RING_SIZE) this.ring.shift();
    this.ring.push(event);
    for (const sub of this.subscribers) {
      try { sub(event); } catch { /* ignore subscriber errors */ }
    }
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /** Returns a snapshot of recent events, optionally filtered by agent name. */
  replay(agentFilter?: string): AgentEvent[] {
    if (!agentFilter) return [...this.ring];
    return this.ring.filter(e => e.agent === agentFilter);
  }

  /** Helper to build a typed event and emit it. */
  start(agent: string, run_id: string, parent_run_id?: string): void {
    this.emit({ event: "start", agent, run_id, ts: new Date().toISOString(), ...(parent_run_id ? { parent_run_id } : {}) });
  }

  progress(agent: string, run_id: string, pct: number, msg: string): void {
    this.emit({ event: "progress", agent, run_id, pct, msg, ts: new Date().toISOString() });
  }

  delay(agent: string, run_id: string, reason: string, retry_in_ms: number): void {
    this.emit({ event: "delay", agent, run_id, reason, retry_in_ms, ts: new Date().toISOString() });
  }

  finish(agent: string, run_id: string, status: "ok" | "error" | "stopped", duration_ms: number): void {
    this.emit({ event: "finish", agent, run_id, status, duration_ms, ts: new Date().toISOString() });
  }

  finding(agent: string, run_id: string, finding_id: string, severity: FindingEvent["severity"], message: string): void {
    this.emit({ event: "finding", agent, run_id, finding_id, severity, message, ts: new Date().toISOString() });
  }
}

export const AgentEventBus = new AgentEventBusImpl();
