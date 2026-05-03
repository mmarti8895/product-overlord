import { GlassPanel, GlassCard } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useLLMStatus, useLLMTraces } from "../api/queries/hooks.js";

interface LLMTrace {
  id: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  degraded: boolean;
  timestamp: string;
}

export function LLMPanel() {
  const { data: statusData } = useLLMStatus();
  const { data: tracesData } = useLLMTraces();

  const status = statusData?.ok ? statusData.data : null;
  const traces: LLMTrace[] = tracesData?.ok
    ? (((tracesData.data as { traces: LLMTrace[] }).traces) ?? [])
    : [];
  const rateLimit = status?.rateLimit;
  const ratePct = rateLimit ? Math.max(0, Math.min(100, (rateLimit.remaining / 60) * 100)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlassPanel style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>LLM Adapter</h2>
          {status ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <GlassBadge variant={status.live ? "ready" : "degraded"} dot>{status.live ? "Live" : "Degraded"}</GlassBadge>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{status.adapter}</span>
            </div>
          ) : (
            <GlassBadge variant="neutral">Loading…</GlassBadge>
          )}
        </div>
        {rateLimit && (
          <div style={{ flex: 1, maxWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
              <span>Rate limit</span>
              <span>{rateLimit.remaining} remaining</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)" }}>
              <div style={{ width: `${ratePct}%`, height: "100%", borderRadius: 3, background: ratePct < 20 ? "var(--blocked)" : "var(--ready)", transition: "width 0.6s" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              Resets {new Date(rateLimit.resetAt).toLocaleTimeString()}
            </div>
          </div>
        )}
      </GlassPanel>

      <GlassPanel>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recent Traces ({traces.length})</h3>
        {traces.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No traces yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
          {traces.map(t => (
            <GlassCard key={t.id} style={{ padding: "8px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{t.model}</span>
                {t.degraded && <GlassBadge variant="degraded" dot>Degraded</GlassBadge>}
                <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: "auto" }}>{t.latencyMs}ms</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                ↑ {t.promptTokens} tok · ↓ {t.completionTokens} tok · {new Date(t.timestamp).toLocaleTimeString()}
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

export default LLMPanel;
