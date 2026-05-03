import { GlassPanel } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import {
  useOrchestratorFindings,
  useAckFinding,
  useEscalateFinding,
  useStopOrchestrator,
} from "../api/queries/agentHooks.js";
import { useOrchestratorStore } from "../stores/orchestratorStore.js";
import type { OrchestratorFinding } from "../stores/orchestratorStore.js";

const SEV_VARIANT: Record<string, "ready" | "degraded" | "blocked" | "neutral"> = {
  info:     "neutral",
  warn:     "degraded",
  critical: "blocked",
};

function FindingRow({ f }: { f: OrchestratorFinding }) {
  const ack       = useAckFinding();
  const escalate  = useEscalateFinding();
  const stopAgent = useStopOrchestrator();

  return (
    <tr style={{ borderBottom: "1px solid var(--glass-border)", fontSize: 13 }}>
      <td style={{ padding: "8px 10px" }}>
        <GlassBadge variant={SEV_VARIANT[f.severity] ?? "neutral"} style={{ fontSize: 10 }}>{f.severity}</GlassBadge>
      </td>
      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11 }}>{f.agent}</td>
      <td style={{ padding: "8px 10px", maxWidth: 360, color: "var(--text-secondary)" }}>{f.message}</td>
      <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-secondary)" }}>{new Date(f.created_at).toLocaleTimeString()}</td>
      <td style={{ padding: "8px 10px" }}>
        <GlassBadge variant={f.status === "acked" ? "neutral" : f.status === "escalated" ? "degraded" : "neutral"} style={{ fontSize: 10 }}>{f.status}</GlassBadge>
      </td>
      <td style={{ padding: "8px 10px" }}>
        {f.status === "open" && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => ack.mutate(f.id)} aria-label={`Acknowledge finding from ${f.agent}`} style={btn("var(--ok)")}>ACK</button>
            <button onClick={() => escalate.mutate(f.id)} aria-label={`Escalate finding from ${f.agent}`} style={btn("var(--warn)")}>↑ Escalate</button>
            <button onClick={() => stopAgent.mutate(f.agent)} aria-label={`Stop agent ${f.agent}`} style={btn("var(--error)")}>⏹ Stop</button>
          </div>
        )}
      </td>
    </tr>
  );
}

function btn(color: string): React.CSSProperties {
  return { fontSize: 11, padding: "2px 8px", borderRadius: 6, background: color, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 };
}

export default function OrchestratorFindingsPanel() {
  useOrchestratorFindings();
  const findings = useOrchestratorStore(s => s.findings);

  const critical = findings.filter(f => f.severity === "critical" && f.status === "open").length;
  const warn     = findings.filter(f => f.severity === "warn"     && f.status === "open").length;
  const acked    = findings.filter(f => f.status === "acked").length;

  return (
    <div role="region" aria-label="Orchestrator Findings" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Orchestrator Findings</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          Anomalies detected by the orchestrator team: thrashing, stalls, and token runaways.
        </p>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Critical", value: critical, color: "var(--error)" },
          { label: "Warning",  value: warn,     color: "var(--warn)" },
          { label: "Acked",    value: acked,    color: "var(--text-secondary)" },
        ].map(s => (
          <GlassPanel key={s.label} style={{ padding: "10px 18px", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.label}</span>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        {findings.length === 0 ? (
          <p style={{ padding: 20, margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            No findings yet. Orchestrator is monitoring…
          </p>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "100%" }} aria-label="Orchestrator findings">
            <caption style={{ display: "none" }}>Orchestrator anomaly findings — thrash, stall, and runaway detections</caption>
            <thead>
              <tr style={{ fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--glass-border)" }}>
                {["Severity", "Agent", "Message", "Time", "Status", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...findings].reverse().map(f => <FindingRow key={f.id} f={f} />)}
            </tbody>
          </table>
        )}
      </GlassPanel>
    </div>
  );
}
