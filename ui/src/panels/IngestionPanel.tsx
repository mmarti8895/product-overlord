import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassPanel, GlassButton, GlassInput } from "../components/glass/index.js";
import { VerdictBadge } from "../components/glass/GlassBadge.js";
import { useForgeIngest } from "../api/queries/hooks.js";
import { useAnalysisStore } from "../stores/analysisStore.js";
import { useToastStore } from "../components/glass/GlassToast.js";

export function IngestionPanel() {
  const [issueKey, setIssueKey] = useState("");
  const [jql, setJql] = useState("");
  const [mode, setMode] = useState<"issue" | "jql">("issue");
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useForgeIngest();
  const setResult = useAnalysisStore(s => s.setResult);
  const { add } = useToastStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = mode === "issue" ? { issueKey } : { jql };
    const res = await mutateAsync(payload);
    if (res.ok) {
      const data = res.data as { runId?: string; run_id?: string };
      const runId = data.runId ?? data.run_id ?? null;
      setResult({ runId });
      add({ kind: "success", message: `Ingestion started${runId ? ` — run ${runId}` : ""}` });
      navigate("/analysis");
    } else {
      add({ kind: "error", message: `Ingestion failed: ${(res as { ok: false; error: { message: string } }).error.message}` });
    }
  }

  return (
    <GlassPanel style={{ maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
        Ingest Issue
      </h2>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["issue", "jql"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "1px solid var(--glass-border)",
              background: mode === m ? "var(--accent)" : "var(--surface-2)",
              color: mode === m ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "background 0.15s",
            }}
          >
            {m === "issue" ? "Issue Key" : "JQL Query"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mode === "issue" ? (
          <GlassInput
            label="Issue Key (e.g. PROJ-123)"
            value={issueKey}
            onChange={e => setIssueKey(e.target.value)}
            required
            pattern="[A-Z]+-\d+"
          />
        ) : (
          <GlassInput
            label="JQL Query"
            value={jql}
            onChange={e => setJql(e.target.value)}
            required
          />
        )}

        <GlassButton type="submit" disabled={isPending} style={{ alignSelf: "flex-end" }}>
          {isPending ? "Ingesting…" : "Ingest →"}
        </GlassButton>
      </form>

      {isPending && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <VerdictBadge verdict="ok" label="Processing…" />
        </div>
      )}
    </GlassPanel>
  );
}

export default IngestionPanel;
