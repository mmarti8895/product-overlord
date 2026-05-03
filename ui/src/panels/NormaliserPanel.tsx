import { useState } from "react";
import { GlassPanel, GlassButton } from "../components/glass/index.js";
import { useAnalysisStore } from "../stores/analysisStore.js";
import { apiFetch } from "../api/client.js";
import { useToastStore } from "../components/glass/GlassToast.js";

export function NormaliserPanel() {
  const { runId } = useAnalysisStore();
  const [json, setJson] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const { add } = useToastStore();

  async function loadNormalised() {
    if (!runId) return;
    setLoading(true);
    const res = await apiFetch<unknown>(`/forge/normalise/${runId}`);
    setLoading(false);
    if (res.ok) {
      setJson(res.data);
    } else {
      add({ kind: "error", message: `Failed to load normalised data` });
    }
  }

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    add({ kind: "success", message: "Copied to clipboard" });
  }

  return (
    <GlassPanel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Normaliser</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {json != null && <GlassButton onClick={copyJson}>Copy JSON</GlassButton>}
          <GlassButton onClick={loadNormalised} disabled={!runId || loading}>
            {loading ? "Loading…" : "Load"}
          </GlassButton>
        </div>
      </div>
      {!runId && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No active run — ingest an issue first.</p>
      )}
      {json != null && (
        <pre
          style={{
            margin: 0,
            padding: 16,
            borderRadius: "var(--radius-md)",
            background: "var(--surface-2)",
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--text-primary)",
            overflow: "auto",
            maxHeight: "60vh",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </GlassPanel>
  );
}

export default NormaliserPanel;
