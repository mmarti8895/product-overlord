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

class AgentRegistryImpl {
  private byRunId = new Map<string, AgentRecord>();
  private byName = new Map<string, Set<string>>(); // name → run_ids

  register(name: string, run_id: string, parent_run_id?: string): AbortController {
    const controller = new AbortController();
    const record: AgentRecord = { name, run_id, started_at: new Date().toISOString(), parent_run_id, controller };
    this.byRunId.set(run_id, record);
    if (!this.byName.has(name)) this.byName.set(name, new Set());
    this.byName.get(name)!.add(run_id);
    return controller;
  }

  deregister(run_id: string): void {
    const record = this.byRunId.get(run_id);
    if (record) {
      this.byName.get(record.name)?.delete(run_id);
      this.byRunId.delete(run_id);
    }
  }

  stopRun(run_id: string): boolean {
    const record = this.byRunId.get(run_id);
    if (!record) return false;
    record.controller.abort();
    return true;
  }

  stopAgent(name: string): number {
    const runIds = this.byName.get(name) ?? new Set();
    let count = 0;
    for (const run_id of runIds) {
      if (this.stopRun(run_id)) count++;
    }
    return count;
  }

  listAgents(): string[] {
    return [...this.byName.keys()];
  }

  listRuns(): AgentRecord[] {
    return [...this.byRunId.values()].map(r => ({ ...r, controller: r.controller }));
  }

  getSignal(run_id: string): AbortSignal | undefined {
    return this.byRunId.get(run_id)?.controller.signal;
  }
}

export const AgentRegistry = new AgentRegistryImpl();
