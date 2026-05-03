import { type ReactNode, type HTMLAttributes } from "react";
import { clsx } from "clsx";

// ── GlassPanel ────────────────────────────────────────────────────────────

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
}

export function GlassPanel({ children, className, padding = true, ...props }: GlassPanelProps) {
  return (
    <div
      className={clsx("glass", padding && "p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── GlassCard ─────────────────────────────────────────────────────────────

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div className={clsx("glass-card p-4", className)} {...props}>
      {children}
    </div>
  );
}
