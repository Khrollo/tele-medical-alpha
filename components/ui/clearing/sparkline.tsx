import * as React from "react";

type SparklineProps = {
  data: number[];
  w?: number;
  h?: number;
  stroke?: string;
  fill?: string;
};

export function Sparkline({
  data,
  w = 100,
  h = 28,
  stroke = "var(--brand-ink)",
  fill = "var(--brand-soft)",
}: SparklineProps) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = Math.max(1, max - min);
  const pts = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * w,
    h - ((v - min) / rng) * (h - 4) - 2,
  ]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const dFill = d + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={dFill} fill={fill} opacity={0.6} />
      <path d={d} stroke={stroke} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
