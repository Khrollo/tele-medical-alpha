"use client";

import * as React from "react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { ChevronDown, FileText, Plus } from "lucide-react";

import { formatDateTime } from "@/app/_lib/utils/format-date";
import { formatVisitStatusLabel } from "@/app/_lib/utils/visit-status-label";

import { Avatar, Btn, Pill, ProgressRing, type PillTone } from "@/components/ui/clearing";

interface OpenVisit {
  id: string;
  patientId: string;
  patientName: string;
  status: string | null;
  priority: string | null;
  appointmentType: string | null;
  createdAt: Date;
  patientJoinToken: string | null;
  twilioRoomName: string | null;
}

interface DoctorInboxDailySummary {
  closedTodayCount: number;
  unclosedTodayCount: number;
  todayNotes: Array<{
    visitId: string;
    patientId: string;
    patientName: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    status: string | null;
    notesStatus: string | null;
    authorId: string | null;
    authorRole: string | null;
  }>;
}

interface OpenNotesContentProps {
  visits: OpenVisit[];
  dailySummary: DoctorInboxDailySummary;
}

type TabKey = "today" | "unclosed" | "closed";

function isClosedStatus(status: string | null): boolean {
  return status === "Signed & Complete";
}

function statusTone(status: string | null, closed: boolean): { tone: PillTone; label: string } {
  if (closed) return { tone: "ok", label: "Signed" };
  const s = (status ?? "").toLowerCase();
  if (s.includes("draft")) return { tone: "accent", label: "In progress" };
  if (s.includes("pending") || s.includes("review")) return { tone: "warn", label: "Awaiting" };
  if (s.includes("sign")) return { tone: "info", label: "Co-sign" };
  return { tone: "neutral", label: formatVisitStatusLabel(status) };
}

function estimatedProgress(status: string | null, closed: boolean): number {
  if (closed) return 100;
  const s = (status ?? "").toLowerCase();
  if (s.includes("sign")) return 90;
  if (s.includes("pending") || s.includes("review")) return 70;
  if (s.includes("draft")) return 45;
  return 30;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  );
}

export function OpenNotesContent({ visits, dailySummary }: OpenNotesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("today");

  React.useEffect(() => {
    const topBarSearch = document.getElementById("open-notes-search") as HTMLInputElement | null;
    if (!topBarSearch) return;
    const handleInput = (e: Event) =>
      setSearchQuery((e.target as HTMLInputElement).value);
    topBarSearch.addEventListener("input", handleInput);
    if (topBarSearch.value !== searchQuery) topBarSearch.value = searchQuery;
    return () => topBarSearch.removeEventListener("input", handleInput);
  }, [searchQuery]);

  const sortedNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = dailySummary.todayNotes.filter((note) => {
      if (!query) return true;
      return (
        note.patientName.toLowerCase().includes(query) ||
        (note.status?.toLowerCase().includes(query) ?? false)
      );
    });
    return filtered.sort((a, b) => {
      const aClosed = isClosedStatus(a.status);
      const bClosed = isClosedStatus(b.status);
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [dailySummary.todayNotes, searchQuery]);

  const tabbed = useMemo(() => {
    if (tab === "today") return sortedNotes.filter((n) => !isClosedStatus(n.status));
    if (tab === "closed") return sortedNotes.filter((n) => isClosedStatus(n.status));
    return sortedNotes;
  }, [sortedNotes, tab]);

  // Group by day
  const groups = useMemo(() => {
    const map: Record<string, typeof tabbed> = {};
    for (const n of tabbed) {
      const d = new Date(n.updatedAt);
      const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : d.toLocaleDateString();
      if (!map[key]) map[key] = [];
      map[key].push(n);
    }
    return map;
  }, [tabbed]);

  const tabs: Array<[TabKey, string, number]> = [
    ["today", "In progress", dailySummary.unclosedTodayCount],
    ["closed", "Closed today", dailySummary.closedTodayCount],
    ["unclosed", "All activity", dailySummary.todayNotes.length],
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div
            className="text-[11.5px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
          >
            Inbox · {dailySummary.unclosedTodayCount} open · {dailySummary.closedTodayCount} signed today
          </div>
          <h1
            className="serif mt-1.5"
            style={{
              fontSize: "clamp(32px, 4vw, 44px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Notes in flight
          </h1>
          <p className="mt-2 max-w-[640px] text-[14px]" style={{ color: "var(--ink-2)" }}>
            Visits you&rsquo;ve started or are waiting on. Drafts auto-save every 30 seconds; unsigned
            notes after 48 hours surface for review.
          </p>
        </div>
        <div className="flex-1" />
      </div>

      {/* Tabs + sort */}
      <div
        className="flex flex-wrap items-center gap-3.5"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        {tabs.map(([k, label, n]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="inline-flex items-center gap-1.5 bg-transparent px-1 py-3 text-[13.5px] tracking-tight"
              style={{
                borderBottom: `2px solid ${active ? "var(--ink)" : "transparent"}`,
                color: active ? "var(--ink)" : "var(--ink-2)",
                fontWeight: active ? 500 : 400,
              }}
            >
              {label}
              <span className="mono text-[11px]" style={{ color: "var(--ink-3)" }}>
                {n}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="flex items-center gap-2 py-1.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
          Sort by
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px]"
            style={{
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
            }}
          >
            Last edited <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Groups */}
      {Object.keys(groups).length === 0 ? (
        <div
          className="flex items-center justify-center rounded-xl px-6 py-16 text-center text-[13px]"
          style={{ border: "1px dashed var(--line-strong)", color: "var(--ink-3)" }}
        >
          {dailySummary.todayNotes.length === 0
            ? "No note activity assigned for today"
            : "No notes match your filters"}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(groups).map(([day, notes]) => (
            <div key={day}>
              <div className="mb-2.5 flex items-baseline gap-2.5">
                <div
                  className="text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
                >
                  {day} · {notes.length} {notes.length === 1 ? "note" : "notes"}
                </div>
                <div className="h-px flex-1" style={{ background: "var(--line)" }} />
              </div>
              <div
                className="overflow-hidden rounded-[14px]"
                style={{ border: "1px solid var(--line)", background: "var(--card)" }}
              >
                {notes.map((note, i) => {
                  const closed = isClosedStatus(note.status);
                  const st = statusTone(note.status, closed);
                  const progress = estimatedProgress(note.status, closed);
                  const linkedVisit = visits.find((v) => v.id === note.visitId);
                  const type = linkedVisit?.appointmentType ?? "Visit";
                  const href = closed
                    ? `/patients/${note.patientId}/visit-history?visitId=${note.visitId}`
                    : `/patients/${note.patientId}/new-visit?visitId=${note.visitId}`;

                  return (
                    <Link
                      key={note.visitId}
                      href={href}
                      className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 transition-colors md:grid-cols-[1fr_160px_140px_110px_160px]"
                      style={{
                        borderBottom: i < notes.length - 1 ? "1px solid var(--line)" : "none",
                        color: "var(--ink)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "var(--paper-2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                      }}
                    >
                      {/* Patient */}
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={note.patientName} size={36} />
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span
                              className="serif nowrap"
                              style={{ fontSize: 18, letterSpacing: "-0.01em", color: "var(--ink)" }}
                            >
                              {note.patientName}
                            </span>
                          </div>
                          <div
                            className="truncate text-[12.5px]"
                            style={{ color: "var(--ink-2)" }}
                          >
                            {formatVisitStatusLabel(note.status)}
                            {type ? ` · ${type}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="hidden md:flex flex-wrap items-center gap-1.5">
                        <Pill tone={st.tone} dot>
                          {st.label}
                        </Pill>
                      </div>

                      {/* Progress */}
                      <div className="hidden md:flex items-center gap-2.5">
                        <ProgressRing value={progress} />
                        <div className="text-[11.5px] leading-tight" style={{ color: "var(--ink-3)" }}>
                          <div style={{ color: "var(--ink-2)" }}>{closed ? "Complete" : "In progress"}</div>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="hidden md:block text-[11.5px] leading-tight" style={{ color: "var(--ink-3)" }}>
                        <div>Updated</div>
                        <div style={{ color: "var(--ink-2)" }}>
                          {formatDateTime(new Date(note.updatedAt))}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex justify-end gap-1.5">
                        <Btn kind={closed ? "ghost" : "accent"} size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                          {closed ? "View" : "Continue"}
                        </Btn>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewVisitButton({ href }: { href: string }) {
  return (
    <Link href={href}>
      <Btn kind="primary" icon={<Plus className="h-4 w-4" />}>
        New visit
      </Btn>
    </Link>
  );
}
