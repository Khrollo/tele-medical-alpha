"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Filter,
  Mic,
  Search,
  Upload,
  UserRound,
  Plus,
  ScrollText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Btn,
  ClearingCard,
  Pill,
  SubTabHeader,
  type PillTone,
} from "@/components/ui/clearing";
import { formatDate, formatDateTime } from "@/app/_lib/utils/format-date";
import type { PatientVisitLogResult } from "@/app/_lib/db/drizzle/queries/visit-log";

interface LogHistoryContentProps {
  patientId: string;
  data: PatientVisitLogResult;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  all: "All events",
  visit_created: "Visit created",
  note_created: "Note created",
  note_updated: "Note updated",
  transcript_created: "Transcript created",
  document_uploaded: "Document uploaded",
  created: "Created",
  finalized: "Finalized",
  edited_after_signing: "Edited after signing",
  assigned: "Assigned",
  assign_to_me: "Assign to me",
  waiting: "Moved to schedule",
  in_progress: "In progress",
};

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "visit_created":
    case "created":
      return CalendarDays;
    case "note_created":
    case "note_updated":
    case "finalized":
    case "edited_after_signing":
      return FileText;
    case "transcript_created":
      return Mic;
    case "document_uploaded":
      return Upload;
    default:
      return UserRound;
  }
}

function eventTypeTone(eventType: string): PillTone {
  switch (eventType) {
    case "finalized":
      return "ok";
    case "edited_after_signing":
      return "warn";
    case "visit_created":
    case "created":
      return "accent";
    case "note_created":
    case "note_updated":
      return "info";
    case "transcript_created":
    case "document_uploaded":
      return "neutral";
    case "assigned":
    case "assign_to_me":
      return "info";
    case "waiting":
      return "warn";
    case "in_progress":
      return "accent";
    default:
      return "neutral";
  }
}

function visitStatusTone(status: string | null | undefined): PillTone {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (
    status === "Signed & Complete" ||
    s === "signed" ||
    s === "completed" ||
    s === "signed & complete" ||
    s === "finalized"
  ) {
    return "ok";
  }
  if (s === "waiting") return "warn";
  if (s === "in progress" || s === "in_progress") return "accent";
  return "neutral";
}

export function LogHistoryContent({ patientId, data }: LogHistoryContentProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [eventType, setEventType] = React.useState("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [expandedVisits, setExpandedVisits] = React.useState<Set<string>>(
    () => new Set(data.visits.slice(0, 2).map((visit) => visit.id))
  );

  const toggleVisit = (visitId: string) => {
    setExpandedVisits((current) => {
      const next = new Set(current);
      if (next.has(visitId)) {
        next.delete(visitId);
      } else {
        next.add(visitId);
      }
      return next;
    });
  };

  const filteredVisits = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return data.visits
      .map((visit) => {
        const events = visit.events.filter((event) => {
          if (eventType !== "all" && event.eventType !== eventType) {
            return false;
          }
          if (from && event.timestamp < from) {
            return false;
          }
          if (to && event.timestamp > to) {
            return false;
          }
          if (!normalizedQuery) {
            return true;
          }

          return [
            visit.id,
            visit.summary || "",
            event.summary,
            event.actor || "",
            EVENT_TYPE_LABELS[event.eventType] || event.eventType,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        });

        const visitMatches =
          !normalizedQuery ||
          [visit.id, visit.summary || "", visit.clinicianName || ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        if (!visitMatches && events.length === 0) {
          return null;
        }

        return {
          ...visit,
          events,
          eventCount: events.length,
        };
      })
      .filter((visit): visit is NonNullable<typeof visit> => Boolean(visit));
  }, [data.visits, eventType, fromDate, searchQuery, toDate]);

  const totalEvents = filteredVisits.reduce(
    (acc, v) => acc + v.eventCount,
    0
  );
  const totalTranscripts = filteredVisits.reduce(
    (acc, v) => acc + v.transcriptCount,
    0
  );
  const totalDocuments = filteredVisits.reduce(
    (acc, v) => acc + v.documentCount,
    0
  );

  const summaryMetrics = [
    {
      k: "Visits",
      v: filteredVisits.length,
      icon: CalendarDays,
      tone: "var(--ink-3)" as const,
    },
    {
      k: "Events",
      v: totalEvents,
      icon: ScrollText,
      tone: "var(--ink-3)" as const,
    },
    {
      k: "Transcripts",
      v: totalTranscripts,
      icon: Mic,
      tone: "var(--ink-3)" as const,
    },
    {
      k: "Documents",
      v: totalDocuments,
      icon: Upload,
      tone: "var(--ink-3)" as const,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <SubTabHeader
        eyebrow="Chart · Visit log"
        title="Visit log"
        subtitle={`Operational timeline for ${data.patient.fullName}.`}
        actions={
          <Link href={`/patients/${patientId}/new-visit`}>
            <Btn kind="accent" icon={<Plus className="h-4 w-4" />}>
              Log new visit
            </Btn>
          </Link>
        }
      />

      {/* Summary strip */}
      <div
        className="grid overflow-hidden rounded-2xl"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        {summaryMetrics.map((m, i, arr) => {
          const Icon = m.icon;
          return (
            <div
              key={m.k}
              className="flex flex-col gap-1.5 px-5 py-4"
              style={{
                borderRight:
                  i < arr.length - 1 ? "1px solid var(--line)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="text-[11px] uppercase"
                  style={{
                    color: "var(--ink-3)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {m.k}
                </div>
                <Icon className="h-3.5 w-3.5" style={{ color: m.tone }} />
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 32,
                  lineHeight: 0.95,
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                }}
              >
                {m.v}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <ClearingCard>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_180px]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--ink-3)" }}
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by visit, event, actor, or summary..."
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter
              className="h-4 w-4 shrink-0"
              style={{ color: "var(--ink-3)" }}
            />
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
          <Input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
      </ClearingCard>

      {/* Visits list */}
      {filteredVisits.length === 0 ? (
        <ClearingCard>
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--paper-2)" }}
            >
              <ClipboardList
                className="h-6 w-6"
                style={{ color: "var(--ink-3)" }}
              />
            </div>
            <p
              className="text-[13px]"
              style={{ color: "var(--ink-3)" }}
            >
              No visit log events match these filters.
            </p>
          </div>
        </ClearingCard>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredVisits.map((visit) => {
            const isExpanded = expandedVisits.has(visit.id);

            return (
              <ClearingCard key={visit.id} pad={0}>
                <div
                  className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
                  style={{ borderBottom: isExpanded ? "1px solid var(--line)" : undefined }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="neutral">
                        {visit.appointmentType || "Visit"}
                      </Pill>
                      {visit.priority && (
                        <Pill tone="info">{visit.priority}</Pill>
                      )}
                      <Pill
                        tone={visitStatusTone(
                          visit.status || visit.notesStatus
                        )}
                        dot
                      >
                        {visit.status || visit.notesStatus || "Draft"}
                      </Pill>
                    </div>
                    <div>
                      <div
                        className="mono text-[11px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        Visit {visit.id}
                      </div>
                      <div
                        className="serif mt-0.5"
                        style={{
                          fontSize: 20,
                          lineHeight: 1.1,
                          letterSpacing: "-0.01em",
                          color: "var(--ink)",
                        }}
                      >
                        {visit.summary || "Operational visit timeline"}
                      </div>
                    </div>
                    <div
                      className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      <span>
                        Started{" "}
                        <span className="mono" style={{ color: "var(--ink)" }}>
                          {formatDateTime(visit.createdAt)}
                        </span>
                      </span>
                      <span>
                        {visit.transcriptCount} transcript
                        {visit.transcriptCount === 1 ? "" : "s"}
                      </span>
                      <span>
                        {visit.documentCount} document
                        {visit.documentCount === 1 ? "" : "s"}
                      </span>
                      <span>
                        {visit.eventCount} event
                        {visit.eventCount === 1 ? "" : "s"}
                      </span>
                      {visit.clinicianName && (
                        <span>Clinician: {visit.clinicianName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/patients/${patientId}/visit-history/${visit.id}`}
                    >
                      <Btn kind="soft" size="sm">
                        Open visit
                      </Btn>
                    </Link>
                    <Btn
                      kind="ghost"
                      size="sm"
                      icon={
                        isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={() => toggleVisit(visit.id)}
                    >
                      {isExpanded ? "Hide events" : "Show events"}
                    </Btn>
                  </div>
                </div>

                {isExpanded && (
                  <div>
                    {visit.events.length === 0 ? (
                      <div
                        className="px-5 py-5 text-center text-[12.5px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        No events match current filters for this visit.
                      </div>
                    ) : (
                      visit.events.map((event, i, arr) => {
                        const EventIcon = getEventIcon(event.eventType);
                        const tone = eventTypeTone(event.eventType);

                        return (
                          <div
                            key={event.id}
                            className="flex gap-3 px-5 py-3.5"
                            style={{
                              borderBottom:
                                i < arr.length - 1
                                  ? "1px solid var(--line)"
                                  : undefined,
                            }}
                          >
                            <div
                              className="mono w-[160px] shrink-0 text-[11.5px] leading-5"
                              style={{ color: "var(--ink-3)" }}
                            >
                              <div style={{ color: "var(--ink)" }}>
                                {formatDateTime(event.timestamp)}
                              </div>
                              <div className="text-[10.5px]">
                                {formatDate(event.timestamp)}
                              </div>
                            </div>
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                              style={{
                                background: "var(--paper-2)",
                                border: "1px solid var(--line)",
                                color: "var(--ink-2)",
                              }}
                            >
                              <EventIcon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div
                                  className="text-[13px] font-medium"
                                  style={{ color: "var(--ink)" }}
                                >
                                  {event.summary}
                                </div>
                                <Pill tone={tone}>
                                  {EVENT_TYPE_LABELS[event.eventType] ||
                                    event.eventType}
                                </Pill>
                              </div>
                              {event.actor && (
                                <div
                                  className="mt-0.5 text-[12px]"
                                  style={{ color: "var(--ink-3)" }}
                                >
                                  By {event.actor}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </ClearingCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
