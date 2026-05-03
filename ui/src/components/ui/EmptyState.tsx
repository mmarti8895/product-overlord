import type { ReactNode } from "react";
import { clsx } from "clsx";

export function EmptyState(props: {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const { title, description, icon, actions, className } = props;
  return (
    <div
      className={clsx(
        "glass-card",
        "rounded-[var(--radius-card)] border border-[color:var(--glass-border)]",
        "p-6 text-center",
        className,
      )}
    >
      {icon && <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[color:var(--ok-bg)]">{icon}</div>}
      <div className="text-[13px] font-semibold text-[color:var(--text-primary)]">{title}</div>
      {description && <div className="mt-1 text-[12px] leading-5 text-[color:var(--text-secondary)]">{description}</div>}
      {actions && <div className="mt-4 flex justify-center gap-2">{actions}</div>}
    </div>
  );
}
