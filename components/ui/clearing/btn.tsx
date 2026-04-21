"use client";

import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";

export type BtnKind = "primary" | "accent" | "soft" | "ghost" | "plain" | "danger";
export type BtnSize = "sm" | "md" | "lg";

type BtnProps = {
  kind?: BtnKind;
  size?: BtnSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  full?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  type?: "button" | "submit" | "reset";
};

const SIZE_CLASSES: Record<BtnSize, string> = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5",
  md: "h-[34px] px-3.5 text-[13.5px] gap-2",
  lg: "h-[42px] px-4.5 text-[14.5px] gap-2.5",
};

const KIND_STYLES: Record<BtnKind, React.CSSProperties> = {
  primary: { background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--ink)" },
  accent:  { background: "var(--brand-ink)", color: "white", border: "1px solid var(--brand-ink)" },
  soft:    { background: "var(--paper-3)", color: "var(--ink)", border: "1px solid var(--line)" },
  ghost:   { background: "transparent", color: "var(--ink)", border: "1px solid var(--line)" },
  plain:   { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
  danger:  { background: "var(--paper)", color: "var(--critical)", border: "1px solid var(--critical-soft)" },
};

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { kind = "ghost", size = "md", icon, iconRight, full, className, children, type = "button", disabled, style, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium tracking-tight transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-[0.5px]",
        SIZE_CLASSES[size],
        full && "w-full",
        className
      )}
      style={{ ...KIND_STYLES[kind], ...style }}
      {...rest}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="inline-flex shrink-0">{iconRight}</span>}
    </button>
  );
});
