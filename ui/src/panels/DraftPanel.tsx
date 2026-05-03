import { useState } from "react";
import { GlassPanel, GlassButton } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useAnalysisStore } from "../stores/analysisStore.js";
import { useSettingsStore } from "../stores/settingsStore.js";
import { apiFetch } from "../api/client.js";
import { useToastStore } from "../components/glass/GlassToast.js";

export function DraftPanel() {
  const { runId } = useAnalysisStore();
  const { shadowMode } = useSettingsStore();
  const { add } = useToastStore();
  const [draft, setDraft] = useState<{ markdown?: string; confirm_post_url?: string; csrf_token?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  async function loadDraft() {
    if (!runId) return;
    setLoading(true);
    const res = await apiFetch<{ markdown: string; confirm_post_url: string; csrf_token: string }>(`/forge/draft/${runId}`);
    setLoading(false);
    if (res.ok) setDraft(res.data);
    else add({ kind: "error", message: "Failed to load draft" });
  }

  async function approveDraft() {
    if (!draft?.confirm_post_url) return;
    const res = await apiFetch(draft.confirm_post_url, { method: "POST", body: JSON.stringify({ csrf_token: draft.csrf_token }) });
    if (res.ok) {
      add({ kind: "success", message: "Comment posted successfully" });
      setDraft(null);
    } else {
      add({ kind: "error", message: "Failed to post comment" });
    }
  }

  if (discarded) {
    return <GlassPanel style={{ maxWidth: 560 }}><p style={{ color: "var(--text-secondary)" }}>Draft discarded.</p></GlassPanel>;
  }

  return (
    <GlassPanel style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Draft Comment</h2>
        {shadowMode && <GlassBadge variant="degraded" dot>Shadow Mode</GlassBadge>}
      </div>

      {shadowMode && (
        <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--degraded-bg)", color: "var(--degraded)", fontSize: 13, marginBottom: 16 }}>
          ⚠️ Shadow mode is active — posting will be simulated, no real Jira comment will be created.
        </div>
      )}

      {!draft && (
        <GlassButton onClick={loadDraft} disabled={!runId || loading}>
          {loading ? "Loading draft…" : "Load Draft"}
        </GlassButton>
      )}

      {draft && (
        <>
          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              maxHeight: "50vh",
              overflow: "auto",
            }}
          >
            {draft.markdown}
          </div>
          {draft.csrf_token && (
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>
              CSRF: <code style={{ padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)" }}>{draft.csrf_token}</code>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <GlassButton onClick={approveDraft}>Approve & Post</GlassButton>
            <GlassButton
              onClick={() => setDiscarded(true)}
              style={{ background: "var(--blocked-bg)", color: "var(--blocked)" }}
            >
              Discard
            </GlassButton>
          </div>
        </>
      )}
    </GlassPanel>
  );
}

export default DraftPanel;
