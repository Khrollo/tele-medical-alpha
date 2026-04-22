"use client";

/**
 * App-wide error boundary. Before this existed there was no segment-level
 * error boundary anywhere under `app/`, so a single uncaught rejection
 * (e.g. the workflow-search server action throwing before the crash fix)
 * would blow away the whole authenticated surface with a bare Next.js
 * development overlay in dev and a white screen in production.
 *
 * We scope it to the root so every client + server component failure has
 * a visible recovery UI. Individual routes can still add more targeted
 * boundaries later without conflicting with this one.
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep this on the client so any production error surface still leaves
    // a trail for operator triage. Server-side errors are already logged.
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected error while rendering this screen. You can try
          again below, or reload to reset the session.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
