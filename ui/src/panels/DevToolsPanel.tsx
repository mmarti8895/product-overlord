import { useState } from "react";
import { GlassPanel } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { LatencyHistogram } from "../components/charts/index.js";
import { useLogStore } from "../stores/logStore.js";
import { useServerConfig } from "../api/queries/hooks.js";

// Exported type names from src/types/index.ts — statically listed
const TYPE_NAMES = [
  "ServerConfig", "AnalysisResult", "CanonicalTicket", "AcceptanceCriteria",
  "EvidenceBundle", "ReadinessScore", "LLMAdapter", "LLMCallResult",
  "RAGChunk", "RetrievalResult", "ComponentCandidate", "ActionPackage",
  "GoldSetEntry", "EvalMetrics", "ForgeInstrumentation", "KBSource",
  "PlanningOutput", "SolutionPlan", "TeamworkNode", "RetryOptions",
  "ConfidenceHistogram", "LatencyBucket", "LogLevel", "Verdict",
];

export function DevToolsPanel() {
  const [typeSearch, setTypeSearch] = useState("");
  const { data: configData } = useServerConfig();
  const entries = useLogStore(s => s.entries);

  const latencies = entries
    .filter(e => e.metadata && typeof (e.metadata as { latencyMs?: number }).latencyMs === "number")
    .slice(-50)
    .map(e => (e.metadata as { latencyMs: number }).latencyMs);

  const retryEntries = entries.filter(e => e.message.includes("retry"));
  const retryByAttempt = [1, 2, 3, 4].map(n => ({
    attempt: n,
    count: retryEntries.filter(e => e.message.includes(`attempt ${n}`)).length,
  }));

  const filteredTypes = TYPE_NAMES.filter(t => t.toLowerCase().includes(typeSearch.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Type explorer */}
      <GlassPanel>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>TypeScript Types</h2>
        <input
          value={typeSearch}
          onChange={e => setTypeSearch(e.target.value)}
          placeholder="Search exported types…"
          aria-label="Search types"
          style={{ padding: "6px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--glass-border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 13, width: "100%", marginBottom: 12, outline: "none" }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filteredTypes.map(t => (
            <GlassBadge key={t} variant="ok">{t}</GlassBadge>
          ))}
          {filteredTypes.length === 0 && <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>No matching types.</span>}
        </div>
      </GlassPanel>

      {/* Live stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Latency histogram */}
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Latency p95 Trend</h3>
          <LatencyHistogram values={latencies} label="ms (from log stream)" />
          {latencies.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
              p95: {[...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? "—"}ms
            </div>
          )}
        </GlassPanel>

        {/* Retry histogram */}
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Retry Distribution</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {retryByAttempt.map(r => (
              <div key={r.attempt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 60 }}>attempt {r.attempt}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--surface-2)" }}>
                  <div style={{ width: r.count > 0 ? `${Math.min(100, r.count * 10)}%` : "0%", height: "100%", borderRadius: 3, background: "var(--accent)", transition: "width 0.5s" }} />
                </div>
                <span style={{ fontSize: 12, color: "var(--text-primary)", width: 24, textAlign: "right" }}>{r.count}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Config dump */}
      {configData?.ok && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Server Config (sanitised)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            {Object.entries(configData.data as Record<string, string>).map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <code style={{ color: "var(--text-secondary)", flexShrink: 0 }}>{k}</code>
                <span style={{ color: v === "[set]" ? "var(--ready)" : v === "[not set]" ? "var(--text-tertiary)" : "var(--text-primary)" }}>{v}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

export default DevToolsPanel;
