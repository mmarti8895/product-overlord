import { type InputHTMLAttributes, useId, useState } from "react";
import { clsx } from "clsx";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function GlassInput({ label, className, value, onChange, style, onFocus, onBlur, ...props }: GlassInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: focused ? "var(--accent)" : "var(--text-secondary)",
            letterSpacing: "0.03em",
            transition: "color 0.15s",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        value={value}
        onChange={onChange}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        className={clsx("w-full text-sm outline-none transition-all", className)}
        style={{
          background: "var(--surface-2)",
          border: `1px solid ${focused ? "var(--accent)" : "var(--glass-border)"}`,
          boxShadow: focused ? "var(--accent-glow)" : undefined,
          borderRadius: "var(--radius-input)",
          padding: "10px 14px",
          color: "var(--text-primary)",
          ...style,
        }}
        placeholder={props.placeholder ?? ""}
        {...props}
      />
    </div>
  );
}
