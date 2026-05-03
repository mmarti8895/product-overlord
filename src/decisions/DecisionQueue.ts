/**
 * DecisionQueue — in-memory queue for agent decisions that require human review.
 * Agents await a Promise that resolves when the human approves/rejects/modifies.
 */

import { randomUUID } from "crypto";
import { AgentEventBus } from "../agents/AgentEventBus.js";

export type DecisionStatus = "pending" | "approved" | "rejected" | "modified";

export interface Decision {
  id: string;
  agent: string;
  run_id: string;
  type: string;
  payload: unknown;
  requires_review: true;
  created_at: string;
  status: DecisionStatus;
  resolution?: { reason?: string; patch?: unknown; resolved_at: string; };
}

type Subscriber = (decision: Decision) => void;
const MAX_SIZE = 500;

class DecisionQueueImpl {
  private queue = new Map<string, Decision>();
  private resolvers = new Map<string, (decision: Decision) => void>();
  private subscribers = new Set<Subscriber>();

  enqueue(agent: string, run_id: string, type: string, payload: unknown): Promise<Decision> {
    // Evict oldest pending if at capacity
    if (this.queue.size >= MAX_SIZE) {
      for (const [id, d] of this.queue) {
        if (d.status === "pending") { this.queue.delete(id); break; }
      }
    }
    const decision: Decision = {
      id: randomUUID(),
      agent, run_id, type, payload,
      requires_review: true,
      created_at: new Date().toISOString(),
      status: "pending",
    };
    this.queue.set(decision.id, decision);
    this.broadcast(decision);
    AgentEventBus.emit({ event: "decision", agent, run_id, decision_id: decision.id, ts: decision.created_at });
    return new Promise(resolve => { this.resolvers.set(decision.id, resolve); });
  }

  approve(id: string): Decision | null {
    return this.resolve(id, "approved");
  }

  reject(id: string, reason?: string): Decision | null {
    return this.resolve(id, "rejected", { reason });
  }

  modify(id: string, patch: unknown): Decision | null {
    return this.resolve(id, "modified", { patch });
  }

  private resolve(id: string, status: DecisionStatus, extra?: { reason?: string; patch?: unknown }): Decision | null {
    const d = this.queue.get(id);
    if (!d || d.status !== "pending") return null;
    d.status = status;
    d.resolution = { ...extra, resolved_at: new Date().toISOString() };
    this.broadcast(d);
    this.resolvers.get(id)?.(d);
    this.resolvers.delete(id);
    return d;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private broadcast(d: Decision): void {
    for (const sub of this.subscribers) {
      try { sub(d); } catch { /* ignore */ }
    }
  }

  list(statusFilter?: DecisionStatus): Decision[] {
    const all = [...this.queue.values()];
    return statusFilter ? all.filter(d => d.status === statusFilter) : all;
  }

  get(id: string): Decision | undefined {
    return this.queue.get(id);
  }

  /** Test helper — clears all state. */
  _resetForTests(): void {
    this.queue.clear();
    this.resolvers.clear();
    this.subscribers.clear();
  }
}

export const DecisionQueue = new DecisionQueueImpl();
