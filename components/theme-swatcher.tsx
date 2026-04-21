"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, ChevronDown, Palette, X } from "lucide-react";
import { cn } from "@/app/_lib/utils/cn";

type ThemeKey = "warm" | "bone" | "cool" | "sage" | "rose" | "graphite";

type ThemeSpec = {
  k: ThemeKey;
  name: string;
  paper: string;
  card: string;
  accent: string;
};

const THEMES: ThemeSpec[] = [
  { k: "warm",     name: "Warm paper", paper: "oklch(0.975 0.006 80)",  card: "oklch(0.992 0.003 80)",  accent: "oklch(0.58 0.09 190)" },
  { k: "bone",     name: "Bone white", paper: "oklch(0.978 0.003 100)", card: "oklch(0.998 0.001 100)", accent: "oklch(0.52 0.16 265)" },
  { k: "cool",     name: "Cool gray",  paper: "oklch(0.960 0.008 240)", card: "oklch(0.985 0.005 240)", accent: "oklch(0.56 0.12 220)" },
  { k: "sage",     name: "Sage",       paper: "oklch(0.958 0.013 140)", card: "oklch(0.985 0.008 140)", accent: "oklch(0.54 0.10 160)" },
  { k: "rose",     name: "Rose clay",  paper: "oklch(0.958 0.011 20)",  card: "oklch(0.985 0.006 20)",  accent: "oklch(0.56 0.15 15)" },
  { k: "graphite", name: "Graphite",   paper: "oklch(0.185 0.004 260)", card: "oklch(0.245 0.006 260)", accent: "oklch(0.72 0.13 195)" },
];

const VALID_KEYS = new Set<string>(THEMES.map((t) => t.k));

export function ThemeSwatcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // One-time migration for users who had the old light/dark/system toggle.
  React.useEffect(() => {
    if (!mounted) return;
    const active = theme ?? resolvedTheme;
    if (active && !VALID_KEYS.has(active)) {
      setTheme("cool");
    }
  }, [mounted, theme, resolvedTheme, setTheme]);

  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const active: ThemeKey = mounted && VALID_KEYS.has(theme ?? "") ? (theme as ThemeKey) : "cool";
  const activeSpec = THEMES.find((t) => t.k === active) ?? THEMES[2];

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left",
          "text-sm text-foreground transition-colors hover:bg-muted"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Palette className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate">{mounted ? activeSpec.name : "Theme"}</span>
        <span className="flex items-center gap-1">
          {THEMES.map((t) => (
            <span
              key={t.k}
              aria-hidden
              className="h-3 w-3 rounded-full border border-black/10"
              style={{
                background: `linear-gradient(135deg, ${t.paper} 0%, ${t.paper} 45%, ${t.card} 46%, ${t.card} 100%)`,
              }}
            />
          ))}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && mounted && (
        <div
          role="listbox"
          className={cn(
            "absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Theme</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close theme picker"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="p-1">
            {THEMES.map((t) => {
              const selected = t.k === active;
              return (
                <li key={t.k}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setTheme(t.k);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      selected ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span
                      className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-md border border-border"
                      style={{ background: t.paper }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-[4px_4px_12px_4px] rounded-[3px]"
                        style={{ background: t.card, border: `1px solid ${t.card}` }}
                      />
                      <span
                        aria-hidden
                        className="absolute bottom-1 right-1 h-2 w-2 rounded-full"
                        style={{ background: t.accent }}
                      />
                    </span>
                    <span className="flex-1 truncate text-foreground">{t.name}</span>
                    {selected && <Check className="h-4 w-4 text-brand-ink" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
