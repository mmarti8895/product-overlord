/**
 * AgentRegistry — tracks active agents and their AbortControllers.
 */
class AgentRegistryImpl {
    byRunId = new Map();
    byName = new Map(); // name → run_ids
    register(name, run_id, parent_run_id) {
        const controller = new AbortController();
        const record = { name, run_id, started_at: new Date().toISOString(), parent_run_id, controller };
        this.byRunId.set(run_id, record);
        if (!this.byName.has(name))
            this.byName.set(name, new Set());
        this.byName.get(name).add(run_id);
        return controller;
    }
    deregister(run_id) {
        const record = this.byRunId.get(run_id);
        if (record) {
            this.byName.get(record.name)?.delete(run_id);
            this.byRunId.delete(run_id);
        }
    }
    stopRun(run_id) {
        const record = this.byRunId.get(run_id);
        if (!record)
            return false;
        record.controller.abort();
        return true;
    }
    stopAgent(name) {
        const runIds = this.byName.get(name) ?? new Set();
        let count = 0;
        for (const run_id of runIds) {
            if (this.stopRun(run_id))
                count++;
        }
        return count;
    }
    listAgents() {
        return [...this.byName.keys()];
    }
    listRuns() {
        return [...this.byRunId.values()].map(r => ({ ...r, controller: r.controller }));
    }
    getSignal(run_id) {
        return this.byRunId.get(run_id)?.controller.signal;
    }
}
export const AgentRegistry = new AgentRegistryImpl();
