/**
 * OrchestratorTeam — monitors AgentEventBus for thrashing, runaway tokens, and stalls.
 */
import { randomUUID } from "crypto";
import { appendFileSync, mkdirSync, existsSync } from "fs";
import { AgentEventBus } from "../agents/AgentEventBus.js";
import { AgentRegistry } from "../agents/AgentRegistry.js";
const FINDINGS_PATH = process.env.FINDINGS_PATH ?? "data/orchestrators/findings.jsonl";
const THRASH_WINDOW_MS = 30_000;
const THRASH_THRESHOLD = 10;
const STALL_TIMEOUT_MS = Number(process.env.ORCHESTRATOR_STALL_TIMEOUT_S ?? 60) * 1000;
const TICK_MS = 5_000;
class OrchestratorTeamImpl {
    findings = new Map();
    eventCounts = new Map();
    lastProgress = new Map(); // run_id → timestamp
    tickInterval;
    unsubscribe;
    start() {
        this.unsubscribe = AgentEventBus.subscribe(e => this.handleEvent(e));
        this.tickInterval = setInterval(() => this.tick(), TICK_MS);
    }
    stop() {
        this.unsubscribe?.();
        if (this.tickInterval)
            clearInterval(this.tickInterval);
    }
    handleEvent(e) {
        const key = `${e.agent}:${e.run_id}`;
        if (e.event === "progress") {
            this.lastProgress.set(e.run_id, Date.now());
        }
        if (e.event === "start" || e.event === "progress") {
            const entry = this.eventCounts.get(key) ?? { count: 0, windowStart: Date.now() };
            if (Date.now() - entry.windowStart > THRASH_WINDOW_MS) {
                entry.count = 1;
                entry.windowStart = Date.now();
            }
            else {
                entry.count++;
                if (entry.count > THRASH_THRESHOLD) {
                    this.emitFinding(e.agent, e.run_id, "critical", "thrash", `Agent ${e.agent} triggered ${entry.count} events in ${THRASH_WINDOW_MS / 1000}s window (thrashing)`);
                    entry.count = 0;
                    entry.windowStart = Date.now();
                }
            }
            this.eventCounts.set(key, entry);
        }
        if (e.event === "finish") {
            this.lastProgress.delete(e.run_id);
            this.eventCounts.delete(key);
        }
    }
    tick() {
        const now = Date.now();
        // Stall detection
        for (const [run_id, lastMs] of this.lastProgress) {
            if (now - lastMs > STALL_TIMEOUT_MS) {
                const runs = AgentRegistry.listRuns();
                const run = runs.find(r => r.run_id === run_id);
                if (run) {
                    this.emitFinding(run.name, run_id, "warn", "stall", `Agent ${run.name} (run ${run_id}) has not emitted a progress event for ${STALL_TIMEOUT_MS / 1000}s`);
                    this.lastProgress.delete(run_id);
                }
            }
        }
    }
    emitFinding(agent, run_id, severity, type, message) {
        const id = randomUUID();
        const finding = {
            id, agent, run_id, severity, type, message,
            created_at: new Date().toISOString(),
            status: "open",
        };
        this.findings.set(id, finding);
        AgentEventBus.finding(agent, run_id, id, severity, message);
        this.persist(finding);
    }
    persist(finding) {
        try {
            const dir = FINDINGS_PATH.split("/").slice(0, -1).join("/");
            if (dir && !existsSync(dir))
                mkdirSync(dir, { recursive: true });
            appendFileSync(FINDINGS_PATH, JSON.stringify(finding) + "\n");
        }
        catch { /* ignore */ }
    }
    ack(id) {
        const f = this.findings.get(id);
        if (!f)
            return null;
        f.status = "acked";
        return f;
    }
    escalate(id) {
        const f = this.findings.get(id);
        if (!f)
            return null;
        f.status = "escalated";
        return f;
    }
    list(status) {
        const all = [...this.findings.values()];
        return status ? all.filter(f => f.status === status) : all;
    }
    get(id) {
        return this.findings.get(id);
    }
}
export const OrchestratorTeam = new OrchestratorTeamImpl();
