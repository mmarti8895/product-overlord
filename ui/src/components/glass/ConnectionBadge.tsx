interface Props {
  status: "idle" | "testing" | "ok" | "error";
  latency_ms?: number;
  error?: string;
}

const STATUS_META = {
  idle:    { icon: "○", color: "var(--text-secondary)", label: "Not tested" },
  testing: { icon: "⟳", color: "var(--warn)",           label: "Testing…" },
  ok:      { icon: "✓", color: "var(--ok)",             label: "Connected" },
  error:   { icon: "✕", color: "var(--error)",          label: "Error" },
};

export function ConnectionBadge({ status, latency_ms, error }: Props) {
  const meta = STATUS_META[status];
  return (
    <span
      title={error ?? meta.label}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: meta.color, fontWeight: 600 }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {status === "ok" && latency_ms != null ? `${latency_ms}ms` : meta.label}
    </span>
  );
}
