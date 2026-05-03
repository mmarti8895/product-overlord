import { NavLink } from "react-router-dom";
import { clsx } from "clsx";

export type TabItem = { id: string; label: string; to: string; badge?: React.ReactNode };

export function Tabs({ items, ariaLabel }: { items: TabItem[]; ariaLabel: string }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "inline-flex items-center gap-1 rounded-[12px] border border-[color:var(--glass-border)]",
        "bg-[color:var(--glass-bg)] p-1",
      )}
    >
      {items.map((t) => (
        <NavLink
          key={t.id}
          to={t.to}
          role="tab"
          className={({ isActive }) =>
            clsx(
              "no-drag relative inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5",
              "text-[12px] font-medium tracking-[-0.01em]",
              "transition-colors duration-150",
              isActive
                ? "bg-[color:var(--surface-1)] text-[color:var(--text-primary)]"
                : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
            )
          }
        >
          <span className="truncate">{t.label}</span>
          {t.badge}
        </NavLink>
      ))}
    </div>
  );
}
