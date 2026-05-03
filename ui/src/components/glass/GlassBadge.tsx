import { clsx } from "clsx";

type BadgeVariant = "ready" | "needs_clarification" | "blocked" | "degraded" | "ok" | "neutral";

interface GlassBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { color: string; bg: string }> = {
  ready:               { color: "var(--ready)",               bg: "var(--ready-bg)" },
  needs_clarification: { color: "var(--needs-clarification)", bg: "var(--needs-clarification-bg)" },
  blocked:             { color: "var(--blocked)",              bg: "var(--blocked-bg)" },
  degraded:            { color: "var(--degraded)",             bg: "var(--degraded-bg)" },
  ok:                  { color: "var(--ok)",                   bg: "var(--ok-bg)" },
  neutral:             { color: "var(--text-secondary)",       bg: "var(--surface-2)" },
};

const verdictLabel: Partial<Record<BadgeVariant, string>> = {
  ready: "Ready",
  needs_clarification: "Needs Clarification",
  blocked: "Blocked",
};

export function GlassBadge({ variant = "neutral", children, className, style, dot = false }: GlassBadgeProps) {
  const { color, bg } = variantStyles[variant];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap",
        className,
      )}
      style={{ color, backgroundColor: bg, ...style }}
    >
      {dot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </span>
  );
}

/** Convenience for verdict strings */
export function VerdictBadge({ verdict, label }: { verdict: string; label?: string }) {
  const v = verdict as BadgeVariant;
  const known: BadgeVariant[] = ["ready", "needs_clarification", "blocked", "degraded", "ok", "neutral"];
  const variant: BadgeVariant = known.includes(v) ? v : "neutral";
  return <GlassBadge variant={variant} dot>{label ?? verdictLabel[variant] ?? verdict}</GlassBadge>;
}
