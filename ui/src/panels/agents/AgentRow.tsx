import { useStopAgent } from "../../api/queries/agentHooks.js";
import type { ActiveAgent } from "../../stores/agentActivityStore.js";

interface Props {
  agent: ActiveAgent;
  isChild?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  running: "var(--warn)",
  ok:      "var(--ok)",
  error:   "var(--error)",
  stopped: "var(--text-secondary)",
};

export function AgentRow({ agent, isChild }: Props) {
  const stop = useStopAgent();

  return (
    <div style={{
      padding: "8px 12px",
      marginLeft: isChild ? 24 : 0,
      borderLeft: isChild ? "2px solid var(--glass-border)" : "none",
      display: "flex", alignItems: "center", gap: 10,
      borderBottom: "1px solid var(--glass-border)",
      fontSize: 13,
    }}>
      <span style={{ fontWeight: 700, color: STATUS_COLOR[agent.status ?? "running"] }}>●</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{agent.name}</span>
      <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>{agent.run_id.slice(0, 8)}</span>

      {agent.last_pct != null && (
        <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--glass-border)", overflow: "hidden" }}>
          <div style={{ width: `${agent.last_pct}%`, height: "100%", background: "var(--accent)", borderRadius: 3, transition: "width 0.3s" }} />
        </div>
      )}

      {agent.last_msg && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.last_msg}</span>
      )}

      <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[agent.status ?? "running"] }}>{agent.status ?? "running"}</span>

      {(agent.status === "running" || !agent.status) && (
        <button
          onClick={() => stop.mutate(agent.run_id)}
          title="Stop this agent"
          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--error)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          ⏹
        </button>
      )}
    </div>
  );
}
