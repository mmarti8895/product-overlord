import { useState } from "react";
import { GlassButton } from "../../components/glass/GlassButton.js";
import { useSaveSchedule } from "../../api/queries/agentHooks.js";
import { useToastStore } from "../../components/glass/GlassToast.js";

interface Props { stages: string[] }

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const DAYS  = [
  { label: "Every day",     value: "*" },
  { label: "Weekdays",      value: "1-5" },
  { label: "Mon",           value: "1" },
  { label: "Wed",           value: "3" },
  { label: "Fri",           value: "5" },
];

export function ScheduleBuilder({ stages }: Props) {
  const [name, setName] = useState("default");
  const [hour, setHour] = useState("02");
  const [day, setDay]   = useState("*");
  const [enabled, setEnabled] = useState(true);
  const save = useSaveSchedule();
  const push = useToastStore(s => s.push);

  const cronExpr = `0 ${hour} * * ${day}`;

  async function handleSave() {
    await save.mutateAsync({ name, cron_expr: cronExpr, stages, enabled });
    push(`Schedule "${name}" saved (${cronExpr})`, "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>⏰ Schedule</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Name</div>
          <input value={name} onChange={e => setName(e.target.value)} style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 13, width: 120 }} />
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Run at (UTC hour)</div>
          <select value={hour} onChange={e => setHour(e.target.value)} style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 13 }}>
            {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Days</div>
          <select value={day} onChange={e => setDay(e.target.value)} style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 13 }}>
            {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
        Cron: <strong>{cronExpr}</strong>
      </div>

      <GlassButton variant="primary" onClick={handleSave} disabled={save.isPending} style={{ alignSelf: "flex-start" }}>
        {save.isPending ? "Saving…" : "Save Schedule"}
      </GlassButton>
    </div>
  );
}
