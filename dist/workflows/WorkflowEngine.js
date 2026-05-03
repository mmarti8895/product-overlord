/**
 * WorkflowEngine — runs pipeline stages sequentially with AbortController support.
 */
import { randomUUID } from "crypto";
import { AgentEventBus } from "../agents/AgentEventBus.js";
// ---------------------------------------------------------------------------
// Stage implementations (stubs — integrate with real modules as needed)
// ---------------------------------------------------------------------------
const STAGE_REGISTRY = {};
function registerStage(stage) { STAGE_REGISTRY[stage.name] = stage; }
function makeStub(name, avgRecords = 20) {
    return {
        name,
        async run(_ctx, signal) {
            if (signal.aborted)
                throw new DOMException("Aborted", "AbortError");
            // Simulate work
            await new Promise((resolve, reject) => {
                const t = setTimeout(resolve, 200);
                signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); });
            });
            const records = Math.floor(Math.random() * avgRecords) + 5;
            return { name, records, new: Math.floor(records * 0.3), updated: Math.floor(records * 0.4), unchanged: Math.floor(records * 0.3), token_estimate: records * 150 };
        },
    };
}
["crawl-docs", "crawl-jira", "crawl-github", "normalise", "enrich", "embed", "upsert-lancedb"]
    .forEach(n => registerStage(makeStub(n)));
// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
const TOKEN_COST_PER_1K = 0.01; // USD, approximate
class WorkflowEngineImpl {
    runs = new Map();
    async plan(stages) {
        const diffs = [];
        for (const name of stages) {
            const stage = STAGE_REGISTRY[name];
            if (!stage)
                continue;
            const ctrl = new AbortController();
            const diff = await stage.run({ runId: "plan", stages, planMode: true }, ctrl.signal);
            diffs.push(diff);
        }
        const estimated_tokens = diffs.reduce((s, d) => s + d.token_estimate, 0);
        return { stages: diffs, estimated_tokens, estimated_cost_usd: (estimated_tokens / 1000) * TOKEN_COST_PER_1K };
    }
    async run(stages) {
        const run_id = randomUUID();
        const controller = new AbortController();
        const runRecord = {
            run_id, stages, status: "running",
            started_at: new Date().toISOString(),
            records_processed: 0,
            error_count: 0,
            controller,
        };
        this.runs.set(run_id, runRecord);
        (async () => {
            const startMs = Date.now();
            AgentEventBus.start("workflow", run_id);
            let pct = 0;
            for (const name of stages) {
                if (controller.signal.aborted) {
                    runRecord.status = "stopped";
                    break;
                }
                const stage = STAGE_REGISTRY[name];
                if (!stage)
                    continue;
                try {
                    AgentEventBus.progress("workflow", run_id, pct, `Running stage: ${name}`);
                    const diff = await stage.run({ runId: run_id, stages, planMode: false }, controller.signal);
                    runRecord.records_processed += diff.records;
                    pct = Math.min(100, pct + Math.floor(100 / stages.length));
                }
                catch (err) {
                    if (err.name === "AbortError") {
                        runRecord.status = "stopped";
                        break;
                    }
                    runRecord.error_count++;
                }
            }
            if (runRecord.status === "running")
                runRecord.status = "completed";
            runRecord.finished_at = new Date().toISOString();
            AgentEventBus.finish("workflow", run_id, runRecord.status === "completed" ? "ok" : runRecord.status === "stopped" ? "stopped" : "error", Date.now() - startMs);
        })();
        return run_id;
    }
    stop(run_id) {
        const run = this.runs.get(run_id);
        if (!run)
            return false;
        run.controller.abort();
        run.status = "stopped";
        run.finished_at = new Date().toISOString();
        return true;
    }
    listRuns() {
        return [...this.runs.values()].map(({ controller: _c, ...r }) => r);
    }
    getRun(run_id) {
        const run = this.runs.get(run_id);
        if (!run)
            return undefined;
        const { controller: _c, ...r } = run;
        return r;
    }
}
export const WorkflowEngine = new WorkflowEngineImpl();
