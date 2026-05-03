import { useState } from "react";
import { GlassPanel } from "../components/glass/GlassPanel.js";
import { GlassButton } from "../components/glass/GlassButton.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import {
  useWorkflowRuns,
  useRunWorkflow,
  usePlanWorkflow,
  useWorkflowSchedules,
} from "../api/queries/agentHooks.js";
import { useWorkflowStore, DEFAULT_STAGES } from "../stores/workflowStore.js";
import { PlanResultCard } from "./workflow/PlanResultCard.js";
import { ScheduleBuilder } from "./workflow/ScheduleBuilder.js";
import { WorkflowRunHistory } from "./workflow/WorkflowRunHistory.js";

const ALL_STAGES = DEFAULT_STAGES;

export default function WorkflowPanel() {
  const [tab, setTab] = useState<"pipeline" | "schedule">("pipeline");
  const [planMode, setPlanMode] = useState(false);

  const { selectedStages, setSelectedStages, planResult, setPlanResult, runs, schedules } = useWorkflowStore();
  useWorkflowRuns();
  useWorkflowSchedules();

  const runWf   = useRunWorkflow();
  const planWf  = usePlanWorkflow();
  const push    = useToastStore(s => s.push);

  function toggleStage(s: string) {
    setSelectedStages(
      selectedStages.includes(s) ? selectedStages.filter(x => x !== s) : [...selectedStages, s]
    );
  }

  async function handlePlan() {
    await planWf.mutateAsync(selectedStages);
  }

  async function handleRun() {
    const { run_id } = await runWf.mutateAsync(selectedStages);
    push(`Workflow started (${run_id.slice(0, 8)})`, "info");
    setPlanResult(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Workflows</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          Define, run, and schedule the crawl → normalize → embed → LanceDB pipeline.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["pipeline", "schedule"] as const).map(t => (
          <GlassButton key={t} variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)} style={{ fontSize: 12, padding: "5px 14px" }}>
            {t === "pipeline" ? "🔄 Pipeline" : "🕐 Schedule"}
          </GlassButton>
        ))}
      </div>

      {tab === "pipeline" && (
        <>
          {/* Plan-mode toggle */}
          <GlassPanel style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={planMode} onChange={e => { setPlanMode(e.target.checked); if (!e.target.checked) setPlanResult(null); }} />
              <strong>Plan mode</strong> — dry-run only, no writes
            </label>
            {planMode && (
              <GlassButton variant="secondary" onClick={handlePlan} disabled={planWf.isPending} style={{ fontSize: 12, padding: "4px 12px" }}>
                {planWf.isPending ? "Estimating…" : "Estimate Cost"}
              </GlassButton>
            )}
          </GlassPanel>

          {/* Plan result */}
          {planMode && planResult && (
            <PlanResultCard
              {...planResult}
              onProceed={() => { setPlanMode(false); handleRun(); }}
              onCancel={() => setPlanResult(null)}
            />
          )}

          {/* Stage selector */}
          <GlassPanel style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Pipeline Stages</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ALL_STAGES.map((stage, i) => (
                <label key={stage} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", padding: "6px 10px", borderRadius: 8, background: selectedStages.includes(stage) ? "var(--ok-bg)" : "transparent" }}>
                  <input type="checkbox" checked={selectedStages.includes(stage)} onChange={() => toggleStage(stage)} />
                  <span style={{ color: "var(--text-secondary)", fontSize: 11, width: 20 }}>{i + 1}.</span>
                  <span style={{ fontFamily: "monospace", fontWeight: selectedStages.includes(stage) ? 600 : 400 }}>{stage}</span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <GlassButton
                variant="primary"
                onClick={planMode ? handlePlan : handleRun}
                disabled={selectedStages.length === 0 || runWf.isPending || planWf.isPending}
              >
                {planMode ? (planWf.isPending ? "Estimating…" : "Estimate Cost") : (runWf.isPending ? "Starting…" : "▶ Run Now")}
              </GlassButton>
              <GlassButton variant="secondary" onClick={() => setSelectedStages([...ALL_STAGES])}>Select All</GlassButton>
              <GlassButton variant="secondary" onClick={() => setSelectedStages([])}>Clear</GlassButton>
            </div>
          </GlassPanel>

          {/* Run history */}
          <GlassPanel style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Run History</div>
            <WorkflowRunHistory runs={runs} />
          </GlassPanel>
        </>
      )}

      {tab === "schedule" && (
        <GlassPanel style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          <ScheduleBuilder stages={selectedStages} />

          {schedules.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Saved Schedules</div>
              {schedules.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--glass-border)" }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>{s.cron_expr}</span>
                  <span style={{ fontSize: 11, color: s.enabled ? "var(--ok)" : "var(--text-secondary)" }}>{s.enabled ? "enabled" : "disabled"}</span>
                  {s.last_run && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>last: {new Date(s.last_run).toLocaleString()}</span>}
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}
    </div>
  );
}
