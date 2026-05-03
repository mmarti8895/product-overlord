import { GlassPanel } from "../../components/glass/GlassPanel.js";
import type { StageDiff } from "../../stores/workflowStore.js";

interface Props {
  stages: StageDiff[];
  estimated_tokens: number;
  estimated_cost_usd: number;
  onProceed: () => void;
  onCancel: () => void;
}

export function PlanResultCard({ stages, estimated_tokens, estimated_cost_usd, onProceed, onCancel }: Props) {
  return (
    <GlassPanel style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, border: "1px solid var(--warn)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📋 Dry-Run Plan</span>
        <span style={{ background: "var(--warn)", color: "#000", borderRadius: 8, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
          ~${estimated_cost_usd.toFixed(4)} USD ±20%
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
          {estimated_tokens.toLocaleString()} tokens
        </span>
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <thead>
          <tr style={{ color: "var(--text-secondary)" }}>
            {["Stage", "Records", "New", "Updated", "Unchanged", "Tokens"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--glass-border)", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stages.map(s => (
            <tr key={s.name}>
              <td style={{ padding: "4px 8px", fontFamily: "monospace" }}>{s.name}</td>
              <td style={{ padding: "4px 8px" }}>{s.records}</td>
              <td style={{ padding: "4px 8px", color: "var(--ok)" }}>+{s.new}</td>
              <td style={{ padding: "4px 8px", color: "var(--warn)" }}>~{s.updated}</td>
              <td style={{ padding: "4px 8px", color: "var(--text-secondary)" }}>{s.unchanged}</td>
              <td style={{ padding: "4px 8px" }}>{s.token_estimate.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onProceed} style={{ padding: "6px 18px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Proceed
        </button>
        <button onClick={onCancel} style={{ padding: "6px 14px", borderRadius: 8, background: "var(--glass-bg)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </GlassPanel>
  );
}
