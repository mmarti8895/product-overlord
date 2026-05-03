import { type InputHTMLAttributes, useId, useState } from "react";
import { clsx } from "clsx";

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function GlassInput({ label, className, value, onChange, ...props }: GlassInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const hasValue = Boolean(value ?? props.defaultValue ?? "");
  const floatLabel = focused || hasValue;

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={clsx(
          "w-full px-4 pt-5 pb-2 rounded-[var(--radius-input)] text-sm outline-none transition-all",
          "text-[var(--text-primary)] placeholder-transparent",
          className,
        )}
        style={{
          background: "var(--surface-2)",
          border: `1px solid ${focused ? "var(--accent)" : "var(--glass-border)"}`,
          boxShadow: focused ? "var(--accent-glow)" : undefined,
        }}
        placeholder={label ?? ""}
        {...props}
      />
      {label && (
        <label
          htmlFor={id}
          className="absolute left-4 transition-all duration-150 pointer-events-none"
          style={{
            top: floatLabel ? "6px" : "50%",
            transform: floatLabel ? "translateY(0)" : "translateY(-50%)",
            fontSize: floatLabel ? "10px" : "14px",
            color: focused ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {label}
        </label>
      )}
    </div>
  );
}
