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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-8 bg-slate-50/30 dark:bg-transparent">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Visit Log</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Operational timeline for {data.patient.fullName}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/patients/${patientId}/new-visit`}>Log New Visit</Link>
        </Button>
      </div>

      <Card className="rounded-[1.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
        <CardContent className="p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_180px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by visit, event, actor, or summary..."
                className="pl-11 rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
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
              className="rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800"
            />
          </div>
        </CardContent>
      </Card>

      {filteredVisits.length === 0 ? (
        <Card className="rounded-[2rem] border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <ClipboardList className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">No visit log events match these filters.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {filteredVisits.map((visit) => {
            const isExpanded = expandedVisits.has(visit.id);

            return (
              <Card key={visit.id} className="rounded-[2rem] border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider">
                            {visit.appointmentType || "Visit"}
                          </Badge>
                          {visit.priority && (
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider">
                              {visit.priority}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider">
                            {visit.status || visit.notesStatus || "Draft"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-slate-500">Visit {visit.id}</p>
                          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                            {visit.summary || "Operational visit timeline"}
                          </h2>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <span>Started {formatDateTime(visit.createdAt)}</span>
                          <span>{visit.transcriptCount} transcript{visit.transcriptCount === 1 ? "" : "s"}</span>
                          <span>{visit.documentCount} document{visit.documentCount === 1 ? "" : "s"}</span>
                          <span>{visit.eventCount} event{visit.eventCount === 1 ? "" : "s"}</span>
                          {visit.clinicianName && <span>Clinician: {visit.clinicianName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                          <Link href={`/patients/${patientId}/visit-history/${visit.id}`}>Open Visit</Link>
                        </Button>
                        <Button variant="ghost" onClick={() => toggleVisit(visit.id)}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="ml-2">{isExpanded ? "Hide events" : "Show events"}</span>
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        {visit.events.map((event) => {
                          const EventIcon = getEventIcon(event.eventType);

                          return (
                            <div
                              key={event.id}
                              className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm dark:bg-slate-900">
                                <EventIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="font-medium text-slate-900 dark:text-white">{event.summary}</p>
                                  <p className="text-xs uppercase tracking-wide text-slate-400">
                                    {formatDateTime(event.timestamp)}
                                  </p>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                                  <span>{EVENT_TYPE_LABELS[event.eventType] || event.eventType}</span>
                                  {event.actor && <span>By {event.actor}</span>}
                                  <span>{formatDate(event.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
