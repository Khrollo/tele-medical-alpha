"use client";

import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";

type FieldGroupProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/** Card-like section with an eyebrow label, serif title, description, optional actions, and body. */
export function FieldGroup({
  eyebrow,
  title,
  description,
  icon,
  actions,
  children,
  className,
}: FieldGroupProps) {
  return (
    <section
      className={cn("flex flex-col gap-3", className)}
      aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-label`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <div
              className="text-[10.5px] uppercase"
              style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
            >
              {eyebrow}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-2">
            {icon && (
              <span className="inline-flex" style={{ color: "var(--brand-ink)" }}>
                {icon}
              </span>
            )}
            <h2
              id={`${title.toLowerCase().replace(/\s+/g, "-")}-label`}
              className="serif"
              style={{
                margin: 0,
                fontSize: 20,
                letterSpacing: "-0.015em",
                color: "var(--ink)",
              }}
            >
              {title}
            </h2>
          </div>
          {description && (
            <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

type VisitFieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  trailing?: React.ReactNode;
};

/** Stacked label + hint + input slot (children). */
export function VisitField({
  label,
  hint,
  required,
  children,
  className,
  trailing,
}: VisitFieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[11.5px] font-medium uppercase"
          style={{ color: "var(--ink-3)", letterSpacing: "0.08em" }}
        >
          {label}
          {required && (
            <span className="ml-1" style={{ color: "var(--critical)" }}>
              *
            </span>
          )}
        </span>
        {trailing}
      </div>
      {children}
      {hint && (
        <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

type VisitSubCardProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/** Lighter inner card used inside a FieldGroup body. */
export function VisitSubCard({ children, className, style }: VisitSubCardProps) {
  return (
    <div
      className={cn("rounded-xl", className)}
      style={{
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type SectionDividerProps = {
  className?: string;
};

/** Subtle horizontal rule for separating groups inside a canvas card. */
export function SectionDivider({ className }: SectionDividerProps) {
  return (
    <div
      className={cn("h-px w-full", className)}
      style={{ background: "var(--line)" }}
    />
  );
}
