import { useState } from "react";
import { GlassPanel } from "../../components/glass/GlassPanel.js";
import { GlassInput } from "../../components/glass/GlassInput.js";
import { GlassButton } from "../../components/glass/GlassButton.js";
import { ConnectionBadge } from "../../components/glass/ConnectionBadge.js";
import { useConnections, useSaveConnection, useTestConnection } from "../../api/queries/agentHooks.js";
import { useConnectionsStore } from "../../stores/connectionsStore.js";
import { useToastStore } from "../../components/glass/GlassToast.js";

export function GitHubConnectionTab() {
  const { data, isLoading } = useConnections("github");
  const save = useSaveConnection("github");
  const test = useTestConnection("github");
  const testResult = useConnectionsStore(s => s.testResults.github);
  const push = useToastStore(s => s.push);

  const [editing, setEditing] = useState(false);
  const [authMode, setAuthMode] = useState<"pat" | "app">("pat");
  const [form, setForm] = useState({ pat: "", appId: "", privateKey: "", repos: "", branchFilter: "main" });

  const status = test.isPending ? "testing" : testResult?.ok === true ? "ok" : testResult?.ok === false ? "error" : "idle";

  return (
    <GlassPanel style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>GitHub</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ConnectionBadge status={status} latency_ms={testResult?.latency_ms} error={testResult?.error} />
          {!editing && <GlassButton variant="secondary" onClick={() => setEditing(true)} style={{ padding: "4px 10px", fontSize: 12 }}>Edit</GlassButton>}
        </div>
      </div>

      {isLoading ? <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</span> : (
        <>
          {editing ? (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {(["pat", "app"] as const).map(m => (
                  <GlassButton key={m} variant={authMode === m ? "primary" : "secondary"} onClick={() => setAuthMode(m)} style={{ fontSize: 12, padding: "4px 12px" }}>{m === "pat" ? "Personal Access Token" : "GitHub App"}</GlassButton>
                ))}
              </div>
              {authMode === "pat" ? (
                <GlassInput label="Personal Access Token" type="password" placeholder="ghp_…" value={form.pat} onChange={e => setForm(f => ({ ...f, pat: e.target.value }))} />
              ) : (
                <>
                  <GlassInput label="App ID" placeholder="123456" value={form.appId} onChange={e => setForm(f => ({ ...f, appId: e.target.value }))} />
                  <GlassInput label="Private Key (PEM)" type="password" placeholder="-----BEGIN RSA PRIVATE KEY-----" value={form.privateKey} onChange={e => setForm(f => ({ ...f, privateKey: e.target.value }))} />
                </>
              )}
              <GlassInput label="Repos (comma-separated, e.g. org/repo)" value={form.repos} onChange={e => setForm(f => ({ ...f, repos: e.target.value }))} />
              <GlassInput label="Branch Filter" value={form.branchFilter} onChange={e => setForm(f => ({ ...f, branchFilter: e.target.value }))} />
              <div style={{ display: "flex", gap: 8 }}>
                <GlassButton variant="primary" disabled={save.isPending} onClick={async () => { await save.mutateAsync({ ...form, repos: form.repos.split(",").map(s => s.trim()).filter(Boolean) }); setEditing(false); push("GitHub connection saved", "success"); }}>Save</GlassButton>
                <GlassButton variant="secondary" onClick={() => setEditing(false)}>Cancel</GlassButton>
              </div>
            </>
          ) : (
            <>
              <div><div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Auth</div><div style={{ fontSize: 13 }}>{data?.pat ? "PAT (set)" : data?.appId ? `App ${data.appId}` : "—"}</div></div>
              <div><div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Repos</div><div style={{ fontSize: 13, fontFamily: "monospace" }}>{(data?.repos as string[] | undefined)?.join(", ") || "—"}</div></div>
              <div><div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>Branch Filter</div><div style={{ fontSize: 13, fontFamily: "monospace" }}>{(data?.branchFilter as string) ?? "—"}</div></div>
              <GlassButton variant="secondary" onClick={() => test.mutateAsync()} disabled={!data || test.isPending} style={{ alignSelf: "flex-start", fontSize: 12 }}>{test.isPending ? "Testing…" : "Test Connection"}</GlassButton>
            </>
          )}
        </>
      )}
    </GlassPanel>
  );
}
