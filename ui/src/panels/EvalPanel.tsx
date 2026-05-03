import { GlassPanel, GlassCard, GlassButton } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useEvalStore, type GoldSetEntry } from "../stores/evalStore.js";
import { useEvalGoldSet, useRunEval } from "../api/queries/hooks.js";
import { useState } from "react";

const BUCKETS = ["all", "regression", "edge-case", "happy-path"];

export function EvalPanel() {
  const [bucketFilter, setBucketFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const { lastResult, running } = useEvalStore();
  const { data: goldData } = useEvalGoldSet();
  const { mutateAsync: runEval } = useRunEval();
  const setRunning = useEvalStore(s => s.setRunning);
  const setResult = useEvalStore(s => s.setResult);

  const allEntries: GoldSetEntry[] = goldData?.ok
    ? ((goldData.data as { entries: GoldSetEntry[] }).entries ?? [])
    : [];
  const entries = allEntries.filter(e =>
    (bucketFilter === "all" || e.bucket === bucketFilter) &&
    (tagFilter === "" || e.tags.some(t => t.includes(tagFilter)))
  );

  async function handleRunEval() {
    setRunning(true);
    const res = await runEval();
    setRunning(false);
    if (res.ok) setResult(res.data as Parameters<typeof setResult>[0]);
  }

  const metrics = lastResult?.metrics;
  const gatePass = lastResult?.passed;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Metrics grid */}
      <GlassPanel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Eval</h2>
          <GlassButton onClick={handleRunEval} disabled={running}>
            {running ? "Running…" : "▶ Run Eval"}
          </GlassButton>
        </div>

        {metrics && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Agreement", value: `${metrics.agreementPct.toFixed(1)}%`, ok: metrics.agreementPct >= 80 },
              { label: "Precision@3", value: metrics.precisionAt3.toFixed(2), ok: metrics.precisionAt3 >= 0.7 },
              { label: "LLM Degraded Rate", value: `${(metrics.llmDegradedRate * 100).toFixed(1)}%`, ok: metrics.llmDegradedRate < 0.1 },
              { label: "RAG p95 Latency", value: `${metrics.ragP95LatencyMs}ms`, ok: metrics.ragP95LatencyMs < 2000 },
            ].map(m => (
              <GlassCard key={m.label} style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.ok ? "var(--ready)" : "var(--blocked)" }}>{m.value}</div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Rollout gate */}
        {lastResult && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: gatePass ? "var(--ready-bg)" : "var(--blocked-bg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <GlassBadge variant={gatePass ? "ready" : "blocked"} dot>
                Rollout Gate: {gatePass ? "PASS" : "BLOCKED"}
              </GlassBadge>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-primary)" }}>
              {metrics && [
                { check: "Agreement ≥ 80%", pass: metrics.agreementPct >= 80 },
                { check: "Precision@3 ≥ 0.70", pass: metrics.precisionAt3 >= 0.7 },
                { check: "LLM degraded rate < 10%", pass: metrics.llmDegradedRate < 0.1 },
                { check: "RAG p95 < 2000ms", pass: metrics.ragP95LatencyMs < 2000 },
              ].map(c => (
                <li key={c.check} style={{ color: c.pass ? "var(--ready)" : "var(--blocked)" }}>
                  {c.pass ? "✓" : "✗"} {c.check}
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassPanel>

      {/* Gold set browser */}
      <GlassPanel>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Gold Set ({allEntries.length})</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {BUCKETS.map(b => (
            <button key={b} onClick={() => setBucketFilter(b)} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid var(--glass-border)", background: bucketFilter === b ? "var(--accent)" : "var(--surface-2)", color: bucketFilter === b ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              {b}
            </button>
          ))}
          <input
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            placeholder="Filter by tag…"
            style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid var(--glass-border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, maxHeight: "40vh", overflowY: "auto" }}>
          {entries.map(e => (
            <GlassCard key={e.id} style={{ padding: "8px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{e.issueKey}</div>
              <GlassBadge variant="neutral">{e.expectedVerdict}</GlassBadge>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {e.tags.map(t => <GlassBadge key={t} variant="ok">{t}</GlassBadge>)}
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

export default EvalPanel;
