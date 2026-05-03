import { useState } from "react";
import { GlassPanel } from "../../components/glass/GlassPanel.js";
import { GlassInput } from "../../components/glass/GlassInput.js";
import { GlassButton } from "../../components/glass/GlassButton.js";
import { ConnectionBadge } from "../../components/glass/ConnectionBadge.js";
import { useConnections, useSaveConnection, useTestConnection } from "../../api/queries/agentHooks.js";
import { useConnectionsStore } from "../../stores/connectionsStore.js";
import { useToastStore } from "../../components/glass/GlassToast.js";

const MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

export function OpenAIConnectionTab() {
  const { data, isLoading } = useConnections("openai");
  const save = useSaveConnection("openai");
  const test = useTestConnection("openai");
  const testResult = useConnectionsStore(s => s.testResults.openai);
  const push = useToastStore(s => s.push);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ apiKey: "", orgId: "", baseUrl: "", plannerModel: "gpt-4o", executorModel: "gpt-4o-mini", reviewerModel: "gpt-4o-mini", tpmBudget: 100000, rpmBudget: 60 });

  const status = test.isPending ? "testing" : testResult?.ok === true ? "ok" : testResult?.ok === false ? "error" : "idle";

  function handleEdit() {
    setForm({ apiKey: "", orgId: (data?.orgId as string) ?? "", baseUrl: (data?.baseUrl as string) ?? "", plannerModel: (data?.plannerModel as string) ?? "gpt-4o", executorModel: (data?.executorModel as string) ?? "gpt-4o-mini", reviewerModel: (data?.reviewerModel as string) ?? "gpt-4o-mini", tpmBudget: (data?.tpmBudget as number) ?? 100000, rpmBudget: (data?.rpmBudget as number) ?? 60 });
    setEditing(true);
  }

  function sel(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  return (
    <GlassPanel style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>OpenAI</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ConnectionBadge status={status} latency_ms={testResult?.latency_ms} error={testResult?.error} />
          {!editing && <GlassButton variant="secondary" onClick={handleEdit} style={{ padding: "4px 10px", fontSize: 12 }}>Edit</GlassButton>}
        </div>
      </div>

      {isLoading ? <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</span> : (
        <>
          {editing ? (
            <>
              <GlassInput label="API Key" type="password" placeholder="sk-…" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
              <GlassInput label="Org ID (optional)" placeholder="org-…" value={form.orgId} onChange={e => setForm(f => ({ ...f, orgId: e.target.value }))} />
              <GlassInput label="Base URL (optional)" placeholder="https://api.openai.com/v1" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
              <div style={{ display: "flex", gap: 12 }}>
                <ModelSelect label="Planner Model" value={form.plannerModel} onChange={sel("plannerModel")} />
                <ModelSelect label="Executor Model" value={form.executorModel} onChange={sel("executorModel")} />
                <ModelSelect label="Reviewer Model" value={form.reviewerModel} onChange={sel("reviewerModel")} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <GlassInput label="TPM Budget" type="number" value={String(form.tpmBudget)} onChange={e => setForm(f => ({ ...f, tpmBudget: Number(e.target.value) }))} />
                <GlassInput label="RPM Budget" type="number" value={String(form.rpmBudget)} onChange={e => setForm(f => ({ ...f, rpmBudget: Number(e.target.value) }))} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <GlassButton variant="primary" onClick={async () => { await save.mutateAsync(form); setEditing(false); push("OpenAI connection saved", "success"); }} disabled={save.isPending}>Save</GlassButton>
                <GlassButton variant="secondary" onClick={() => setEditing(false)}>Cancel</GlassButton>
              </div>
            </>
          ) : (
            <>
              {[["API Key", data ? "***" : "—"], ["Planner", (data?.plannerModel as string) ?? "—"], ["Executor", (data?.executorModel as string) ?? "—"], ["TPM", String(data?.tpmBudget ?? "—")], ["RPM", String(data?.rpmBudget ?? "—")]].map(([l, v]) => (
                <div key={l}><div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{l}</div><div style={{ fontSize: 13, fontFamily: "monospace" }}>{v}</div></div>
              ))}
              <GlassButton variant="secondary" onClick={() => test.mutateAsync()} disabled={!data || test.isPending} style={{ alignSelf: "flex-start", fontSize: 12 }}>{test.isPending ? "Testing…" : "Test Connection"}</GlassButton>
            </>
          )}
        </>
      )}
    </GlassPanel>
  );
}

function ModelSelect({ label, value, onChange }: { label: string; value: string; onChange: React.ChangeEventHandler<HTMLSelectElement> }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={onChange} style={{ width: "100%", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 13 }}>
        {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );
}
