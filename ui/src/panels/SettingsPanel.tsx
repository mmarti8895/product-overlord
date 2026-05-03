import { useState } from "react";
import { GlassPanel, GlassButton, GlassInput } from "../components/glass/index.js";
import { GlassModal } from "../components/glass/GlassModal.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useSettingsStore } from "../stores/settingsStore.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import { useServerStatus } from "../api/queries/hooks.js";

const FLAG_KEYS = ["shadowMode", "degradedLLM", "degradedRepo"] as const;
const FLAG_LABELS: Record<typeof FLAG_KEYS[number], string> = {
  shadowMode: "SHADOW_MODE",
  degradedLLM: "DEGRADED_LLM",
  degradedRepo: "DEGRADED_REPO",
};

export function SettingsPanel() {
  const store = useSettingsStore();
  const { add } = useToastStore();
  const { data: statusData } = useServerStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [localUrl, setLocalUrl] = useState(store.serverUrl);
  const [localToken, setLocalToken] = useState(store.authToken);

  function handleSave() {
    setConfirmOpen(true);
  }

  function confirmSave() {
    store.setServerUrl(localUrl);
    store.setAuthToken(localToken);
    add({ kind: "success", message: "Settings saved" });
    setConfirmOpen(false);
  }

  const serverOk = statusData?.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>
      {/* Server connection */}
      <GlassPanel>
        <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Server Connection</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <GlassInput label="Server URL" value={localUrl} onChange={e => setLocalUrl(e.target.value)} />
          <GlassInput label="Auth Token (optional)" value={localToken} onChange={e => setLocalToken(e.target.value)} type="password" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <GlassButton onClick={handleSave}>Save Settings</GlassButton>
          <GlassBadge variant={serverOk ? "ready" : "blocked"} dot>
            {serverOk ? "Connected" : "Disconnected"}
          </GlassBadge>
        </div>
      </GlassPanel>

      {/* Degraded mode toggles */}
      <GlassPanel>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Degraded Mode Flags</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FLAG_KEYS.map(key => (
            <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "monospace" }}>{FLAG_LABELS[key]}</span>
              <div
                role="switch"
                aria-checked={store[key]}
                onClick={() => {
                  if (key === "shadowMode") store.setShadowMode(!store.shadowMode);
                  else if (key === "degradedLLM") store.setDegradedLLM(!store.degradedLLM);
                  else store.setDegradedRepo(!store.degradedRepo);
                }}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: store[key] ? "var(--degraded)" : "var(--surface-2)",
                  border: "1px solid var(--glass-border)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 2,
                  left: store[key] ? 20 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }} />
              </div>
            </label>
          ))}
        </div>
      </GlassPanel>

      {/* Server info */}
      {statusData?.ok && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Server Info</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(statusData.data).map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)", fontFamily: "monospace", width: 120 }}>{k}</span>
                <span style={{ color: "var(--text-primary)" }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Confirm modal */}
      <GlassModal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Save Settings?">
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          This will update the server URL and auth token. Changes take effect immediately.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <GlassButton onClick={confirmSave}>Confirm</GlassButton>
          <GlassButton onClick={() => setConfirmOpen(false)}>Cancel</GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}

export default SettingsPanel;
