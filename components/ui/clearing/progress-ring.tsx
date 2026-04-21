import * as React from "react";

type ProgressRingProps = {
  value: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
};

export function ProgressRing({ value, size = 32, stroke = 3, showLabel = true }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamped / 100);
  return (
    <svg width={size} height={size} aria-label={`${clamped}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="var(--brand-ink)"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {showLabel && (
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-2)" }}
        >
          {clamped}
        </text>
      )}
    </svg>
  );
}
