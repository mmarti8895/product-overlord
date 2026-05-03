import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Section(props: {
  title?: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { title, description, right, children, className } = props;
  return (
    <section className={clsx("space-y-3", className)}>
      {(title || description || right) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                {description}
              </p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
