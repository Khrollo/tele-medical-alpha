import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";

export type PillTone = "neutral" | "accent" | "critical" | "warn" | "ok" | "info" | "ink";

type PillProps = {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const TONES: Record<PillTone, { bg: string; color: string; bd: string }> = {
  neutral:  { bg: "var(--paper-3)",     color: "var(--ink-2)",   bd: "var(--line)" },
  accent:   { bg: "var(--brand-soft)",  color: "var(--brand-ink)", bd: "transparent" },
  critical: { bg: "var(--critical-soft)", color: "var(--critical)", bd: "transparent" },
  warn:     { bg: "var(--warn-soft)",   color: "oklch(0.5 0.12 70)", bd: "transparent" },
  ok:       { bg: "var(--ok-soft)",     color: "var(--ok)",      bd: "transparent" },
  info:     { bg: "var(--info-soft)",   color: "var(--info)",    bd: "transparent" },
  ink:      { bg: "var(--ink)",         color: "var(--paper)",   bd: "transparent" },
};

export function Pill({ tone = "neutral", dot, className, children, style }: PillProps) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium tracking-tight",
        className
      )}
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.bd}`, ...style }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
