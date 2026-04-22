"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Btn, ClearingCard } from "@/components/ui/clearing";

interface OnboardingHintProps {
  storageKey: string;
  title: string;
  body: string;
  anchor?: "top-right" | "bottom-right" | "bottom-left";
}

const STORAGE_PREFIX = "onboarding:";

export function OnboardingHint({
  storageKey,
  title,
  body,
  anchor = "bottom-right",
}: OnboardingHintProps) {
  const [dismissed, setDismissed] = React.useState(true);
  const key = `${STORAGE_PREFIX}${storageKey}`;

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      setDismissed(stored === "1");
    } catch {
      setDismissed(false);
    }
  }, [key]);

  const handleDismiss = React.useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, [key]);

  if (dismissed) return null;

  const positionStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 60,
    maxWidth: 320,
    ...(anchor === "top-right"
      ? { top: 24, right: 24 }
      : anchor === "bottom-left"
      ? { bottom: 24, left: 24 }
      : { bottom: 24, right: 24 }),
  };

  return (
    <div style={positionStyle} role="dialog" aria-labelledby={`${key}-title`}>
      <ClearingCard pad={0}>
        <div
          className="flex items-start gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="min-w-0 flex-1">
            <div
              className="text-[10.5px] uppercase"
              style={{
                color: "var(--ink-3)",
                letterSpacing: "0.12em",
                fontWeight: 600,
              }}
            >
              Quick tip
            </div>
            <div
              id={`${key}-title`}
              className="serif mt-1"
              style={{
                fontSize: 16,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              {title}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss tip"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
            style={{ color: "var(--ink-3)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--paper-2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-4 py-3 text-[13px]" style={{ color: "var(--ink-2)" }}>
          {body}
        </div>
        <div
          className="flex items-center justify-end px-3 py-2.5"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <Btn kind="primary" size="sm" onClick={handleDismiss}>
            Got it
          </Btn>
        </div>
      </ClearingCard>
    </div>
  );
}
