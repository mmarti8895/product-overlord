/**
 * OrchestratorTeam — monitors AgentEventBus for thrashing, runaway tokens, and stalls.
 */

import { randomUUID } from "crypto";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { AgentEventBus } from "../agents/AgentEventBus.js";
import type { AgentEvent } from "../agents/AgentEventBus.js";
import { AgentRegistry } from "../agents/AgentRegistry.js";

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

const FINDINGS_PATH = process.env.FINDINGS_PATH ?? "data/orchestrators/findings.jsonl";
const THRASH_WINDOW_MS = 30_000;
const THRASH_THRESHOLD = 10;
const STALL_TIMEOUT_MS = Number(process.env.ORCHESTRATOR_STALL_TIMEOUT_S ?? 60) * 1000;
const TICK_MS = 5_000;

class OrchestratorTeamImpl {
  private findings = new Map<string, OrchestratorFinding>();
  private eventCounts = new Map<string, { count: number; windowStart: number }>();
  private lastProgress = new Map<string, number>(); // run_id → timestamp
  private tickInterval?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;

  start(): void {
    this.unsubscribe = AgentEventBus.subscribe(e => this.handleEvent(e));
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    this.unsubscribe?.();
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  private handleEvent(e: AgentEvent): void {
    const key = `${e.agent}:${e.run_id}`;
    if (e.event === "progress") {
      this.lastProgress.set(e.run_id, Date.now());
    }
    if (e.event === "start" || e.event === "progress") {
      const entry = this.eventCounts.get(key) ?? { count: 0, windowStart: Date.now() };
      if (Date.now() - entry.windowStart > THRASH_WINDOW_MS) {
        entry.count = 1; entry.windowStart = Date.now();
      } else {
        entry.count++;
        if (entry.count > THRASH_THRESHOLD) {
          this.emitFinding(e.agent, e.run_id, "critical", "thrash",
            `Agent ${e.agent} triggered ${entry.count} events in ${THRASH_WINDOW_MS / 1000}s window (thrashing)`);
          entry.count = 0; entry.windowStart = Date.now();
        }
      }
      this.eventCounts.set(key, entry);
    }
    if (e.event === "finish") {
      this.lastProgress.delete(e.run_id);
      this.eventCounts.delete(key);
    }
  }

  private tick(): void {
    const now = Date.now();
    // Stall detection
    for (const [run_id, lastMs] of this.lastProgress) {
      if (now - lastMs > STALL_TIMEOUT_MS) {
        const runs = AgentRegistry.listRuns();
        const run = runs.find(r => r.run_id === run_id);
        if (run) {
          this.emitFinding(run.name, run_id, "warn", "stall",
            `Agent ${run.name} (run ${run_id}) has not emitted a progress event for ${STALL_TIMEOUT_MS / 1000}s`);
          this.lastProgress.delete(run_id);
        }
      }
    }
  }

  private emitFinding(agent: string, run_id: string, severity: FindingSeverity, type: OrchestratorFinding["type"], message: string): void {
    const id = randomUUID();
    const finding: OrchestratorFinding = {
      id, agent, run_id, severity, type, message,
      created_at: new Date().toISOString(),
      status: "open",
    };
    this.findings.set(id, finding);
    AgentEventBus.finding(agent, run_id, id, severity, message);
    this.persist(finding);
  }

  private persist(finding: OrchestratorFinding): void {
    try {
      const dir = FINDINGS_PATH.split("/").slice(0, -1).join("/");
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(FINDINGS_PATH, JSON.stringify(finding) + "\n");
    } catch { /* ignore */ }
  }

  ack(id: string): OrchestratorFinding | null {
    const f = this.findings.get(id);
    if (!f) return null;
    f.status = "acked";
    return f;
  }

  escalate(id: string): OrchestratorFinding | null {
    const f = this.findings.get(id);
    if (!f) return null;
    f.status = "escalated";
    return f;
  }

  list(status?: OrchestratorFinding["status"]): OrchestratorFinding[] {
    const all = [...this.findings.values()];
    return status ? all.filter(f => f.status === status) : all;
  }

  get(id: string): OrchestratorFinding | undefined {
    return this.findings.get(id);
  }
}

export const OrchestratorTeam = new OrchestratorTeamImpl();
