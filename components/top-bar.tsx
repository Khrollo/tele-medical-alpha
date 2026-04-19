"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { cn } from "@/app/_lib/utils/cn";

type Crumb = string | { label: string; href?: string };

type TopBarProps = {
  breadcrumb?: Crumb[];
  title?: string;
  onOpenMobileMenu?: () => void;
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export function TopBar({ breadcrumb, title, onOpenMobileMenu, children, right, className }: TopBarProps) {
  return (
    <header
      className={cn("flex h-[60px] items-center gap-3.5 px-4 md:px-7", className)}
      style={{
        background: "var(--paper)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {onOpenMobileMenu && (
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md md:hidden"
          style={{ color: "var(--ink-2)" }}
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {breadcrumb.map((c, i) => {
            const isLast = i === breadcrumb.length - 1;
            const label = typeof c === "string" ? c : c.label;
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span aria-hidden style={{ color: "var(--ink-4)" }}>
                    /
                  </span>
                )}
                <span style={{ color: isLast ? "var(--ink)" : "var(--ink-3)" }}>{label}</span>
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {title && !breadcrumb && (
        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {title}
        </div>
      )}

      <div className="flex-1 min-w-0">{children}</div>

      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}
