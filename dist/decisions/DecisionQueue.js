/**
 * DecisionQueue — in-memory queue for agent decisions that require human review.
 * Agents await a Promise that resolves when the human approves/rejects/modifies.
 */
import { randomUUID } from "crypto";
import { AgentEventBus } from "../agents/AgentEventBus.js";
const MAX_SIZE = 500;
class DecisionQueueImpl {
    queue = new Map();
    resolvers = new Map();
    subscribers = new Set();
    enqueue(agent, run_id, type, payload) {
        // Evict oldest pending if at capacity
        if (this.queue.size >= MAX_SIZE) {
            for (const [id, d] of this.queue) {
                if (d.status === "pending") {
                    this.queue.delete(id);
                    break;
                }
            }
        }
        const decision = {
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
    approve(id) {
        return this.resolve(id, "approved");
    }
    reject(id, reason) {
        return this.resolve(id, "rejected", { reason });
    }
    modify(id, patch) {
        return this.resolve(id, "modified", { patch });
    }
    resolve(id, status, extra) {
        const d = this.queue.get(id);
        if (!d || d.status !== "pending")
            return null;
        d.status = status;
        d.resolution = { ...extra, resolved_at: new Date().toISOString() };
        this.broadcast(d);
        this.resolvers.get(id)?.(d);
        this.resolvers.delete(id);
        return d;
    }
    subscribe(fn) {
        this.subscribers.add(fn);
        return () => this.subscribers.delete(fn);
    }
    broadcast(d) {
        for (const sub of this.subscribers) {
            try {
                sub(d);
            }
            catch { /* ignore */ }
        }
    }
    list(statusFilter) {
        const all = [...this.queue.values()];
        return statusFilter ? all.filter(d => d.status === statusFilter) : all;
    }
    get(id) {
        return this.queue.get(id);
    }
    /** Test helper — clears all state. */
    _resetForTests() {
        this.queue.clear();
        this.resolvers.clear();
        this.subscribers.clear();
    }
}
export const DecisionQueue = new DecisionQueueImpl();
