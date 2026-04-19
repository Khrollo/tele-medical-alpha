import * as React from "react";

type SubTabHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export function SubTabHeader({ eyebrow, title, subtitle, actions }: SubTabHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <div
            className="text-[11.5px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="serif mt-1.5"
          style={{
            fontSize: "clamp(28px, 3.5vw, 36px)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </>
      )}
    </div>
  );
}
