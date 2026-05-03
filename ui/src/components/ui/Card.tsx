import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "glass-card",
        "rounded-[var(--radius-card)] border border-[color:var(--glass-border)]",
        "bg-[color:var(--surface-2)]",
        "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader(props: {
  title: string;
  description?: string;
  right?: ReactNode;
  className?: string;
}) {
  const { title, description, right, className } = props;
  return (
    <div className={clsx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
        {description && (
          <div className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
            {description}
          </div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("p-4", className)} {...props} />;
}
