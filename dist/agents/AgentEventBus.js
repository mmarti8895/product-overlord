/**
 * AgentEventBus — singleton pub-sub bus for agent lifecycle events.
 * Keeps a ring buffer of the last RING_SIZE events for late-joining SSE clients.
 */
const RING_SIZE = 2000;
class AgentEventBusImpl {
    ring = [];
    subscribers = new Set();
    emit(event) {
        if (this.ring.length >= RING_SIZE)
            this.ring.shift();
        this.ring.push(event);
        for (const sub of this.subscribers) {
            try {
                sub(event);
            }
            catch { /* ignore subscriber errors */ }
        }
    }
    subscribe(fn) {
        this.subscribers.add(fn);
        return () => this.subscribers.delete(fn);
    }
    /** Returns a snapshot of recent events, optionally filtered by agent name. */
    replay(agentFilter) {
        if (!agentFilter)
            return [...this.ring];
        return this.ring.filter(e => e.agent === agentFilter);
    }
    /** Helper to build a typed event and emit it. */
    start(agent, run_id, parent_run_id) {
        this.emit({ event: "start", agent, run_id, ts: new Date().toISOString(), ...(parent_run_id ? { parent_run_id } : {}) });
    }
    progress(agent, run_id, pct, msg) {
        this.emit({ event: "progress", agent, run_id, pct, msg, ts: new Date().toISOString() });
    }
    delay(agent, run_id, reason, retry_in_ms) {
        this.emit({ event: "delay", agent, run_id, reason, retry_in_ms, ts: new Date().toISOString() });
    }
    finish(agent, run_id, status, duration_ms) {
        this.emit({ event: "finish", agent, run_id, status, duration_ms, ts: new Date().toISOString() });
    }
    finding(agent, run_id, finding_id, severity, message) {
        this.emit({ event: "finding", agent, run_id, finding_id, severity, message, ts: new Date().toISOString() });
    }
}
export const AgentEventBus = new AgentEventBusImpl();
