import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function GlassButton({
  children,
  className,
  variant = "primary",
  size = "md",
  disabled,
  ...props
}: GlassButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-full transition-all select-none";

  const sizes = {
    sm: "px-3 py-1 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
  };

  const variants = {
    primary: "text-white",
    secondary: "text-[var(--text-primary)]",
    danger: "text-white",
    ghost: "text-[var(--text-secondary)]",
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={clsx(base, sizes[size], variants[variant], className)}
      style={{
        background: variant === "primary" ? "var(--accent)"
          : variant === "danger" ? "var(--blocked)"
          : "var(--surface-2)",
        boxShadow: variant === "primary" && !disabled ? "var(--accent-glow)" : undefined,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
