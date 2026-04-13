"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import {
  searchWorkflowAction,
  type WorkflowSearchItem,
  type WorkflowSearchResults,
} from "@/app/_actions/workflow-search";
import { Input } from "@/components/ui/input";
import { cn } from "@/app/_lib/utils/cn";

interface WorkflowCommandSearchProps {
  placeholder: string;
  className?: string;
}

const GROUP_ORDER: Array<keyof WorkflowSearchResults> = [
  "patients",
  "visits",
  "tasks",
  "destinations",
];

const GROUP_LABELS: Record<keyof WorkflowSearchResults, string> = {
  patients: "Patients",
  visits: "Visits",
  tasks: "Tasks",
  destinations: "Destinations",
};

export function WorkflowCommandSearch({
  placeholder,
  className,
}: WorkflowCommandSearchProps) {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const requestIdRef = React.useRef(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<WorkflowSearchResults>({
    patients: [],
    visits: [],
    tasks: [],
    destinations: [],
  });
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [isPending, startTransition] = React.useTransition();
  const deferredQuery = React.useDeferredValue(query);

  const flatItems = React.useMemo(
    () => GROUP_ORDER.flatMap((group) => results[group]),
    [results]
  );

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    startTransition(async () => {
      const nextResults = await searchWorkflowAction(deferredQuery);
      if (requestIdRef.current === currentRequestId) {
        setResults(nextResults);
        setHighlightedIndex(0);
      }
    });
  }, [deferredQuery, isOpen]);

  const handleNavigate = React.useCallback(
    (item: WorkflowSearchItem) => {
      setIsOpen(false);
      setQuery("");
      router.push(item.href);
    },
    [router]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
      setIsOpen(true);
      return;
    }

    if (!flatItems.length) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current === 0 ? flatItems.length - 1 : current - 1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleNavigate(flatItems[highlightedIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-9 pr-14"
        autoComplete="off"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ctrl+K"}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[26rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
          {flatItems.length === 0 ? (
            <div className="rounded-xl px-4 py-6 text-sm text-muted-foreground">
              No matching workflows found.
            </div>
          ) : (
            GROUP_ORDER.map((group) => {
              const items = results[group];
              if (!items.length) return null;

              const itemOffset = GROUP_ORDER.slice(0, GROUP_ORDER.indexOf(group)).reduce(
                (total, currentGroup) => total + results[currentGroup].length,
                0
              );

              return (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="space-y-1">
                    {items.map((item, index) => {
                      const absoluteIndex = itemOffset + index;
                      const isActive = absoluteIndex === highlightedIndex;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setHighlightedIndex(absoluteIndex)}
                          onClick={() => handleNavigate(item)}
                          className={cn(
                            "flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition-colors",
                            isActive
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                              : "bg-transparent text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-900/80"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{item.title}</div>
                            <div
                              className={cn(
                                "truncate text-xs",
                                isActive ? "text-slate-200 dark:text-slate-700" : "text-slate-500"
                              )}
                            >
                              {item.subtitle}
                            </div>
                          </div>
                          {item.badge && (
                            <span
                              className={cn(
                                "ml-3 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                                isActive
                                  ? "bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-900"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300"
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
