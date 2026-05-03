import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: Variant;
    size?: Size;
    leftIcon?: ReactNode;
  },
) {
  const {
    children,
    className,
    variant = "secondary",
    size = "md",
    leftIcon,
    disabled,
    ...rest
  } = props;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-[12px] font-medium tracking-[-0.01em] " +
    "transition-colors duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-[12px]",
    md: "h-9 px-3.5 text-[13px]",
  };

  const variants: Record<Variant, string> = {
    primary:
      "bg-[color:var(--accent)] text-white shadow-[0_0_0_3px_rgba(10,132,255,0.18)] hover:bg-[color:var(--accent-hover)]",
    secondary:
      "bg-[color:var(--surface-2)] text-[color:var(--text-primary)] border border-[color:var(--glass-border)] hover:bg-[color:var(--surface-hover)]",
    danger:
      "bg-[color:var(--blocked)] text-white hover:brightness-110",
    ghost:
      "bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
  };

  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      disabled={disabled}
      {...rest}
    >
      {leftIcon}
      {children}
    </button>
  );
}
