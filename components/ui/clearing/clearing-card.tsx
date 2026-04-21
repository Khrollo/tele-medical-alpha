import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";

type ClearingCardProps = {
  pad?: number;
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function ClearingCard({ pad = 20, accent, className, style, children }: ClearingCardProps) {
  return (
    <div
      className={cn("relative rounded-[14px]", className)}
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        padding: pad,
        ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
