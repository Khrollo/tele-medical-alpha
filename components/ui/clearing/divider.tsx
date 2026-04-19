import * as React from "react";

type DividerProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
  style?: React.CSSProperties;
};

export function Divider({ orientation = "horizontal", className, style }: DividerProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--line)",
        ...(orientation === "vertical" ? { width: 1, height: "100%" } : { height: 1, width: "100%" }),
        ...style,
      }}
    />
  );
}
