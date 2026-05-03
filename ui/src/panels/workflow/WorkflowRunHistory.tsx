import { useStopWorkflow } from "../../api/queries/agentHooks.js";
import type { WorkflowRun } from "../../stores/workflowStore.js";

interface Props { runs: WorkflowRun[] }

const STATUS_COLORS: Record<string, string> = {
  running:   "var(--warn)",
  completed: "var(--ok)",
  stopped:   "var(--text-secondary)",
  error:     "var(--error)",
};

function fmt(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function WorkflowRunHistory({ runs }: Props) {
  const stop = useStopWorkflow();

  if (runs.length === 0) {
    return <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>No runs yet. Click "Run Now" to start.</p>;
  }

  return (
    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
      <thead>
        <tr style={{ color: "var(--text-secondary)" }}>
          {["Run ID", "Status", "Started", "Duration", "Records", "Errors", ""].map(h => (
            <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--glass-border)", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...runs].reverse().map(r => {
          const durationMs = r.finished_at
            ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
            : Date.now() - new Date(r.started_at).getTime();
          return (
            <tr key={r.run_id} style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>{r.run_id.slice(0, 8)}…</td>
              <td style={{ padding: "6px 8px" }}>
                <span style={{ color: STATUS_COLORS[r.status] ?? "inherit", fontWeight: 600 }}>{r.status}</span>
              </td>
              <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{new Date(r.started_at).toLocaleTimeString()}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(durationMs)}</td>
              <td style={{ padding: "6px 8px" }}>{r.records_processed}</td>
              <td style={{ padding: "6px 8px", color: r.error_count > 0 ? "var(--error)" : "inherit" }}>{r.error_count}</td>
              <td style={{ padding: "6px 8px" }}>
                {r.status === "running" && (
                  <button
                    onClick={() => stop.mutate({ run_id: r.run_id })}
                    style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--error)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    ⏹ Stop
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
