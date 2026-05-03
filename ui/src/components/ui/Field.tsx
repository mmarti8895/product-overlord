import { clsx } from "clsx";
import type { ReactNode } from "react";

export function KeyValue({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-[color:var(--text-secondary)]">{label}</div>
      <div className={clsx("text-[13px] text-[color:var(--text-primary)]", mono && "font-mono")}>{value}</div>
    </div>
  );
}
