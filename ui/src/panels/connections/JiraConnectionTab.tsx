import { useState } from "react";
import { GlassPanel } from "../../components/glass/GlassPanel.js";
import { GlassInput } from "../../components/glass/GlassInput.js";
import { GlassButton } from "../../components/glass/GlassButton.js";
import { ConnectionBadge } from "../../components/glass/ConnectionBadge.js";
import { useConnections, useSaveConnection, useTestConnection } from "../../api/queries/agentHooks.js";
import { useConnectionsStore } from "../../stores/connectionsStore.js";
import { useToastStore } from "../../components/glass/GlassToast.js";

export function JiraConnectionTab() {
  const { data, isLoading } = useConnections("jira");
  const save = useSaveConnection("jira");
  const test = useTestConnection("jira");
  const testResult = useConnectionsStore(s => s.testResults.jira);
  const push = useToastStore(s => s.push);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ baseUrl: "", projectKey: "", token: "" });

  const status = test.isPending ? "testing" : testResult?.ok === true ? "ok" : testResult?.ok === false ? "error" : "idle";

  function handleEdit() {
    setForm({ baseUrl: (data?.baseUrl as string) ?? "", projectKey: (data?.projectKey as string) ?? "", token: "" });
    setEditing(true);
  }

  async function handleSave() {
    await save.mutateAsync(form);
    setEditing(false);
    push("Jira connection saved", "success");
  }

  async function handleTest() {
    await test.mutateAsync();
  }

  return (
    <GlassPanel style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Jira</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ConnectionBadge status={status} latency_ms={testResult?.latency_ms} error={testResult?.error} />
          {!editing && <GlassButton variant="secondary" onClick={handleEdit} style={{ padding: "4px 10px", fontSize: 12 }}>Edit</GlassButton>}
        </div>
      </div>

      {isLoading ? <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</span> : (
        <>
          {editing ? (
            <>
              <GlassInput label="Base URL" placeholder="https://yourorg.atlassian.net" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
              <GlassInput label="Project Key" placeholder="DEMO" value={form.projectKey} onChange={e => setForm(f => ({ ...f, projectKey: e.target.value }))} />
              <GlassInput label="API Token" type="password" placeholder="Enter token…" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} />
              <div style={{ display: "flex", gap: 8 }}>
                <GlassButton variant="primary" onClick={handleSave} disabled={save.isPending}>Save</GlassButton>
                <GlassButton variant="secondary" onClick={() => setEditing(false)}>Cancel</GlassButton>
              </div>
            </>
          ) : (
            <>
              <Field label="Base URL" value={(data?.baseUrl as string) ?? "—"} />
              <Field label="Project Key" value={(data?.projectKey as string) ?? "—"} />
              <Field label="Token" value={data ? "***" : "—"} />
              <GlassButton variant="secondary" onClick={handleTest} disabled={!data || test.isPending} style={{ alignSelf: "flex-start", fontSize: 12 }}>
                {test.isPending ? "Testing…" : "Test Connection"}
              </GlassButton>
            </>
          )}
        </>
      )}
    </GlassPanel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}
