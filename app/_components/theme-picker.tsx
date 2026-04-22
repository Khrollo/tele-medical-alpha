"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Palette } from "lucide-react";
import { cn } from "@/app/_lib/utils/cn";

const THEMES: Array<{
  id: string;
  label: string;
  description: string;
  swatch: { paper: string; brand: string; ink: string };
}> = [
  {
    id: "cool",
    label: "Cool",
    description: "Cool gray · balanced",
    swatch: {
      paper: "oklch(0.960 0.008 240)",
      brand: "oklch(0.56 0.12 220)",
      ink: "oklch(0.19 0.020 240)",
    },
  },
  {
    id: "warm",
    label: "Warm",
    description: "Cream · heart mode",
    swatch: {
      paper: "oklch(0.975 0.006 80)",
      brand: "oklch(0.58 0.09 190)",
      ink: "oklch(0.18 0.012 80)",
    },
  },
  {
    id: "bone",
    label: "Bone",
    description: "Off-white · editorial",
    swatch: {
      paper: "oklch(0.978 0.003 100)",
      brand: "oklch(0.52 0.16 265)",
      ink: "oklch(0.16 0.005 260)",
    },
  },
  {
    id: "sage",
    label: "Sage",
    description: "Pale green · clinical calm",
    swatch: {
      paper: "oklch(0.958 0.013 140)",
      brand: "oklch(0.54 0.10 160)",
      ink: "oklch(0.20 0.020 160)",
    },
  },
  {
    id: "rose",
    label: "Rose",
    description: "Blush · approachable",
    swatch: {
      paper: "oklch(0.958 0.011 20)",
      brand: "oklch(0.56 0.13 20)",
      ink: "oklch(0.20 0.020 20)",
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Dark · low light",
    swatch: {
      paper: "oklch(0.18 0.010 240)",
      brand: "oklch(0.72 0.10 220)",
      ink: "oklch(0.96 0.008 240)",
    },
  },
];

interface ThemePickerProps {
  compact?: boolean;
}

export function ThemePicker({ compact = false }: ThemePickerProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  if (!mounted) return null;
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={compact ? `Theme: ${current.label}` : undefined}
        className={cn(
          "flex w-full items-center rounded-md text-[13px] transition-colors",
          compact ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
        )}
        style={{ color: "var(--ink-2)", background: "transparent" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--paper-3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Palette className="h-4 w-4 shrink-0" />
        {!compact && (
          <>
            <span className="animate-in fade-in duration-300">Theme</span>
            <span
              aria-hidden
              className="ml-auto h-3.5 w-3.5 rounded-full"
              style={{
                background: current.swatch.brand,
                border: "1px solid var(--line)",
              }}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute z-50 w-60 overflow-hidden rounded-xl"
          style={{
            bottom: "calc(100% + 6px)",
            left: compact ? 0 : undefined,
            right: compact ? undefined : 0,
            background: "var(--card)",
            border: "1px solid var(--line)",
            boxShadow: "0 10px 30px oklch(0 0 0 / 0.12)",
          }}
        >
          <div
            className="px-3 py-2 text-[10.5px] uppercase"
            style={{
              color: "var(--ink-3)",
              letterSpacing: "0.12em",
              fontWeight: 600,
              borderBottom: "1px solid var(--line)",
            }}
          >
            Theme
          </div>
          {THEMES.map((t) => {
            const selected = t.id === current.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--paper-2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: t.swatch.paper,
                    border: "1px solid var(--line)",
                    position: "relative",
                  }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      background: t.swatch.brand,
                      boxShadow: `0 0 0 2px ${t.swatch.paper}`,
                    }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[13px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {t.label}
                  </span>
                  <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {t.description}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
