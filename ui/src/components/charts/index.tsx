interface ConfidenceBarProps {
  label: string;
  confidence: number; // 0.0–1.0
  sublabel?: string;
  lowConfidence?: boolean;
}

export function ConfidenceBar({ label, confidence, sublabel, lowConfidence }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const color = lowConfidence ? "var(--needs-clarification)"
    : confidence >= 0.7 ? "var(--ready)"
    : confidence >= 0.4 ? "var(--needs-clarification)"
    : "var(--blocked)";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-primary)" }}>{label}</span>
        <span style={{ color }} className="font-mono font-medium">{pct}%</span>
      </div>
      {sublabel && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{sublabel}</span>}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

interface LatencyHistogramProps {
  values: number[]; // latency in ms
  label?: string;
}

export function LatencyHistogram({ values, label }: LatencyHistogramProps) {
  if (!values.length) return (
    <div className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>No data yet</div>
  );
  const max = Math.max(...values, 1);
  const last20 = values.slice(-20);
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>}
      <div className="flex items-end gap-0.5 h-12">
        {last20.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              height: `${Math.max(4, (v / max) * 48)}px`,
              background: v > 1500 ? "var(--blocked)" : v > 500 ? "var(--needs-clarification)" : "var(--ok)",
              opacity: 0.7 + (i / last20.length) * 0.3,
            }}
            title={`${v}ms`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span>p50: {values.sort((a,b) => a-b)[Math.floor(values.length * 0.5)]}ms</span>
        <span>p95: {values.sort((a,b) => a-b)[Math.floor(values.length * 0.95)]}ms</span>
      </div>
    </div>
  );
}
