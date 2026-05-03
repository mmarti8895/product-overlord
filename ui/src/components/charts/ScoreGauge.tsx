import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { clsx } from "clsx";

interface ScoreGaugeProps {
  score: number; // 0–100
  size?: number;
  className?: string;
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreGauge({ score, size = 140, className }: ScoreGaugeProps) {
  const spring = useSpring(0, { stiffness: 80, damping: 18 });

  useEffect(() => { spring.set(score); }, [score, spring]);

  const dashOffset = useTransform(spring, (v) =>
    CIRCUMFERENCE - (v / 100) * CIRCUMFERENCE
  );

  const color =
    score >= 80 ? "var(--ready)"
    : score >= 50 ? "var(--needs-clarification)"
    : "var(--blocked)";

  return (
    <div className={clsx("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        {/* Fill */}
        <motion.circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      {/* Score text */}
      <div className="absolute flex flex-col items-center">
        <motion.span
          className="text-2xl font-bold tabular-nums"
          style={{ color }}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>score</span>
      </div>
    </div>
  );
}
