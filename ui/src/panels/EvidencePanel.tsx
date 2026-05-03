import { GlassPanel, GlassCard } from "../components/glass/index.js";
import { VerdictBadge } from "../components/glass/GlassBadge.js";
import { useEvidenceRuns, useEvidenceBundle } from "../api/queries/hooks.js";
import { useEvidenceStore } from "../stores/evidenceStore.js";

interface RunRow { runId: string; issueKey: string; verdict: string; score: number; timestamp: string; }

export function EvidencePanel() {
  const { data } = useEvidenceRuns();
  const { selectedRunId, selectRun, clearSelection } = useEvidenceStore();
  const { data: bundleData, isLoading } = useEvidenceBundle(selectedRunId);

  const runs: RunRow[] = (data?.ok ? (data.data as { runs: RunRow[] }).runs : []) ?? [];

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* Run history list */}
      <GlassPanel style={{ flex: "0 0 320px" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Run History</h2>
        {runs.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No runs yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflowY: "auto" }}>
          {runs.map(run => (
            <GlassCard
              key={run.runId}
              role="button"
              tabIndex={0}
              onClick={() => selectRun(run.runId, null)}
              onKeyDown={e => e.key === "Enter" && selectRun(run.runId, null)}
              style={{
                cursor: "pointer",
                padding: "10px 14px",
                border: selectedRunId === run.runId ? "1px solid var(--accent)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{run.issueKey}</span>
                <VerdictBadge verdict={run.verdict} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                {run.runId} · {new Date(run.timestamp).toLocaleString()}
              </div>
              <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "var(--surface-2)" }}>
                <div style={{ width: `${run.score}%`, height: "100%", borderRadius: 2, background: "var(--accent)" }} />
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassPanel>

      {/* Bundle drill-down */}
      {selectedRunId && (
        <GlassPanel style={{ flex: 1, maxHeight: "80vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Evidence Bundle</h2>
            <button onClick={clearSelection} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }} aria-label="Close">✕</button>
          </div>
          {isLoading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>}
          {bundleData?.ok && (
            <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify((bundleData.data), null, 2)}
            </pre>
          )}
        </GlassPanel>
      )}
    </div>
  );
}

export default EvidencePanel;
