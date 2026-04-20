"use client";

import * as React from "react";
import { AudioLines, Copy, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AICaptureLiveState } from "./ai-capture-panel";

export type TranscriptEntry = {
  id: string;
  text: string;
  speaker?: "Clinician" | "Patient" | "Note";
  timestamp: number; // seconds from session start
  createdAt: Date;
};

type TranscriptPanelProps = {
  history: TranscriptEntry[];
  live: AICaptureLiveState | null;
  className?: string;
};

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptPanel({ history, live, className }: TranscriptPanelProps) {
  const [copied, setCopied] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const allText = React.useMemo(() => {
    const lines = history.map((h) => `[${formatTimestamp(h.timestamp)}] ${h.speaker ?? "Clinician"}: ${h.text}`);
    if (live?.liveTranscript) {
      lines.push(`[${formatTimestamp(live.recordingTime)}] Clinician: ${live.liveTranscript}`);
    }
    return lines.join("\n");
  }, [history, live]);

  const hasContent = history.length > 0 || !!live?.liveTranscript || !!live?.interimTranscript;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(allText);
      setCopied(true);
      toast.success("Transcript copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Failed to copy transcript");
    }
  };

  // Auto-scroll to bottom when new content arrives
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history.length, live?.liveTranscript, live?.interimTranscript]);

  return (
    <aside
      className={className}
      style={{
        width: 340,
        flexShrink: 0,
        background: "var(--paper-2)",
        borderLeft: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <AudioLines className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
          Live transcript
        </div>
        {live?.isCapturing && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase"
            style={{
              background: "var(--critical-soft)",
              color: "var(--critical)",
              letterSpacing: "0.08em",
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--critical)" }}
            />
            REC
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleCopy}
          disabled={!hasContent}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] transition-colors disabled:opacity-40"
          style={{ color: "var(--ink-2)" }}
          onMouseEnter={(e) => {
            if (hasContent) (e.currentTarget as HTMLButtonElement).style.background = "var(--paper-3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className="scroll flex-1 overflow-y-auto px-4 py-4"
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {!hasContent ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-[12.5px]"
            style={{ color: "var(--ink-3)" }}
          >
            <AudioLines
              className="h-6 w-6"
              style={{
                color: live?.isCapturing ? "var(--brand-ink)" : "var(--ink-4)",
              }}
            />
            <div className="max-w-[240px] leading-[1.45]">
              {live?.isCapturing ? (
                <>
                  Listening…
                  <span className="mono ml-1" style={{ color: "var(--ink-2)" }}>
                    {formatTimestamp(live.recordingTime)}
                  </span>
                  <div className="mt-1">
                    Start speaking — utterances will appear here as the AI scribe transcribes them.
                  </div>
                </>
              ) : live?.state === "transcribing" || live?.state === "uploading" || live?.state === "converting" ? (
                <>Transcribing audio…</>
              ) : (
                <>Tap the mic to start capturing. Each utterance will appear here with a timestamp.</>
              )}
            </div>
          </div>
        ) : (
          <>
            {history.map((entry) => (
              <TranscriptLine key={entry.id} entry={entry} />
            ))}

            {live?.liveTranscript && (
              <TranscriptLine
                entry={{
                  id: "live-current",
                  text: live.liveTranscript,
                  speaker: "Clinician",
                  timestamp: live.recordingTime,
                  createdAt: new Date(),
                }}
                highlighted
              />
            )}

            {live?.interimTranscript && (
              <div className="flex gap-2.5">
                <div
                  className="mono text-[10.5px]"
                  style={{ color: "var(--ink-3)", minWidth: 40, paddingTop: 2 }}
                >
                  {formatTimestamp(live.recordingTime)}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[11px] font-semibold uppercase"
                    style={{ color: "var(--brand-ink)", letterSpacing: "0.06em" }}
                  >
                    Clinician
                  </div>
                  <div
                    className="mt-0.5 text-[13px] italic"
                    style={{ color: "var(--ink-3)", lineHeight: 1.5 }}
                  >
                    {live.interimTranscript}
                    <span style={{ color: "var(--brand-ink)" }}> ●</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ok)" }} />
        <span className="text-[11px] leading-[1.35]" style={{ color: "var(--ink-3)" }}>
          Patient consented to recording · encrypted at rest · retained 30 days
        </span>
      </div>
    </aside>
  );
}

function TranscriptLine({
  entry,
  highlighted,
}: {
  entry: TranscriptEntry;
  highlighted?: boolean;
}) {
  const speakerColor =
    entry.speaker === "Patient" ? "var(--ink-3)" : "var(--brand-ink)";
  const speakerLabel = entry.speaker ?? "Clinician";
  return (
    <div className="flex gap-2.5">
      <div
        className="mono text-[10.5px]"
        style={{ color: "var(--ink-3)", minWidth: 40, paddingTop: 2 }}
      >
        {formatTimestamp(entry.timestamp)}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-semibold uppercase"
          style={{ color: speakerColor, letterSpacing: "0.06em" }}
        >
          {speakerLabel}
        </div>
        <div
          className="mt-0.5 text-[13px]"
          style={{
            color: "var(--ink)",
            lineHeight: 1.5,
            background: highlighted ? "var(--brand-soft)" : undefined,
            borderRadius: highlighted ? 6 : undefined,
            padding: highlighted ? "2px 6px" : undefined,
            display: highlighted ? "inline-block" : "block",
          }}
        >
          {entry.text}
        </div>
      </div>
    </div>
  );
}
