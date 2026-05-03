import { ScoreGauge } from "../components/charts/ScoreGauge.js";
import { GlassPanel, GlassCard } from "../components/glass/index.js";
import { VerdictBadge, GlassBadge } from "../components/glass/GlassBadge.js";
import { useAnalysisStore } from "../stores/analysisStore.js";
import { useState } from "react";

export function AnalysisPanel() {
  const { verdict, score, dimensions, missingItems, questions, loading, runId } = useAnalysisStore();
  const [qTab, setQTab] = useState<"PM" | "Engineer" | "QA">("PM");

  if (!runId && !loading) {
    return (
      <GlassPanel style={{ maxWidth: 560, textAlign: "center", color: "var(--text-secondary)", padding: 48 }}>
        No active run. Go to <strong>Ingestion</strong> to start.
      </GlassPanel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <GlassPanel style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <ScoreGauge score={score} size={100} />
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>Run ID: {runId}</div>
          {verdict && <VerdictBadge verdict={verdict} />}
          {loading && <GlassBadge variant="ok">Analysing…</GlassBadge>}
        </div>
      </GlassPanel>

      {/* Dimension grid */}
      {dimensions.length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Dimensions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {dimensions.map(d => (
              <GlassCard key={d.name} style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{d.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <GlassBadge variant={d.pass ? "ready" : "blocked"} dot>{d.pass ? "Pass" : "Fail"}</GlassBadge>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto" }}>w={d.weight}</span>
                </div>
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: "var(--surface-2)" }}>
                  <div style={{ width: `${d.score}%`, height: "100%", borderRadius: 2, background: d.pass ? "var(--ready)" : "var(--blocked)", transition: "width 0.6s ease" }} />
                </div>
              </GlassCard>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Missing items */}
      {missingItems.length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Missing Items</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {missingItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <GlassBadge variant={item.source === "llm" ? "needs_clarification" : "neutral"} dot>
                  {item.source}
                </GlassBadge>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.field}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Clarification questions */}
      {questions.length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Clarification Questions</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["PM", "Engineer", "QA"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setQTab(tab)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  border: "1px solid var(--glass-border)",
                  background: qTab === tab ? "var(--accent)" : "var(--surface-2)",
                  color: qTab === tab ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {questions.filter(q => q.role === qTab).map((q, i) => (
              <li key={i} style={{ fontSize: 13, color: "var(--text-primary)" }}>{q.question}</li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}

export default AnalysisPanel;
