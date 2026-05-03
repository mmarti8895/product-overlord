import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("mx-auto w-full max-w-[1200px]", className)}>
      {children}
    </div>
  );
}

export function PageHeader(
  props: {
    title: string;
    description?: string;
    right?: ReactNode;
    badge?: ReactNode;
  } & { className?: string },
) {
  const { title, description, right, badge, className } = props;
  return (
    <div className={clsx("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-semibold leading-6 tracking-[-0.012em] text-[var(--text-primary)]">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 max-w-[70ch] text-[13px] leading-5 text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
