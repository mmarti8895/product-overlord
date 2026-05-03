import { useState } from "react";
import { GlassPanel, GlassCard, GlassButton } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { apiFetch } from "../api/client.js";
import { useAnalysisStore } from "../stores/analysisStore.js";

interface ActionPackage {
  branchName: string;
  files: string[];
  components: string[];
  tests: string[];
}

interface ComponentCandidate {
  name: string;
  path: string;
  confidence: number;
}

export function PlanningPanel() {
  const { runId } = useAnalysisStore();
  const [pkg, setPkg] = useState<ActionPackage | null>(null);
  const [candidates, setCandidates] = useState<ComponentCandidate[]>([]);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!runId) return;
    setLoading(true);
    const res = await apiFetch<{ action_package: ActionPackage; candidates: ComponentCandidate[]; diff?: string }>(`/forge/plan/${runId}`);
    setLoading(false);
    if (res.ok) {
      setPkg(res.data.action_package);
      setCandidates(res.data.candidates ?? []);
      setDiff(res.data.diff ?? null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlassPanel style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Planning</h2>
        <GlassButton onClick={load} disabled={!runId || loading}>{loading ? "Loading…" : "Load Plan"}</GlassButton>
      </GlassPanel>

      {pkg && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Action Package</h3>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong style={{ color: "var(--text-secondary)" }}>Branch: </strong>
            <code style={{ padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-primary)" }}>{pkg.branchName}</code>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {([["Files", pkg.files], ["Components", pkg.components], ["Tests", pkg.tests]] as [string, string[]][]).map(([label, items]) => (
              <div key={label}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
                <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                  {items.map(item => <li key={item} style={{ fontSize: 12, color: "var(--text-primary)" }}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {candidates.length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Component Candidates</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidates.map(c => (
              <GlassCard key={c.name} style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{Math.round(c.confidence * 100)}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--surface-2)" }}>
                  <div style={{ width: `${c.confidence * 100}%`, height: "100%", borderRadius: 2, background: c.confidence < 0.5 ? "var(--needs-clarification)" : "var(--ready)", transition: "width 0.6s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{c.path}</div>
                {c.confidence < 0.5 && <GlassBadge variant="needs_clarification" dot style={{ marginTop: 4 }}>Low confidence</GlassBadge>}
              </GlassCard>
            ))}
          </div>
        </GlassPanel>
      )}

      {diff && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>OpenSpec Diff Preview</h3>
          <pre style={{ margin: 0, padding: 12, borderRadius: "var(--radius-md)", background: "var(--surface-2)", fontSize: 11, lineHeight: 1.6, color: "var(--text-primary)", overflow: "auto", maxHeight: "40vh", whiteSpace: "pre-wrap" }}>
            {diff}
          </pre>
        </GlassPanel>
      )}
    </div>
  );
}

export default PlanningPanel;
