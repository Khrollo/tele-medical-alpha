"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Search,
  X,
  ChevronRight,
  Filter,
  ClipboardList,
  CalendarDays,
  Clock,
  CheckCircle2,
  Plus,
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
import type { VisitHistoryResult } from "@/app/_lib/db/drizzle/queries/visit-history";
import { formatDateTime } from "@/app/_lib/utils/format-date";
import { formatVisitStatusLabel } from "@/app/_lib/utils/visit-status-label";

interface VisitHistoryContentProps {
  patientId: string;
  userRole: string;
  data: VisitHistoryResult;
  searchQuery: string | null;
}

function visitStatusTone(status: string | null): PillTone {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (
    status === "Signed & Complete" ||
    s === "signed" ||
    s === "completed" ||
    s === "signed & complete" ||
    s === "finalized" ||
    s === "signed_and_complete"
  ) {
    return "ok";
  }
  if (status === "Waiting" || s === "waiting") return "warn";
  if (status === "In Progress" || s === "in_progress" || s === "in progress") return "accent";
  if (s === "draft") return "neutral";
  if (s === "cancelled" || s === "canceled") return "neutral";
  return "neutral";
}

function priorityTone(priority: string): PillTone {
  const p = priority.toLowerCase();
  if (p === "high" || p === "urgent" || p === "critical") return "critical";
  if (p === "medium" || p === "moderate") return "warn";
  return "ok";
}

export function VisitHistoryContent({
  patientId,
  userRole: _userRole,
  data,
  searchQuery: initialSearchQuery,
}: VisitHistoryContentProps) {
  void _userRole;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery || "");

  const currentStatus = searchParams.get("status") || "all";
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const formatDateForInput = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    if (!updates.page) {
      params.set("page", "1");
    }

    router.push(`/patients/${patientId}/visit-history?${params.toString()}`);
  };

  const handleStatusChange = (value: string) => {
    updateFilters({ status: value });
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ from: e.target.value || null });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ to: e.target.value || null });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchQuery || null });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    router.push(`/patients/${patientId}/visit-history`);
  };

  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage.toString() });
  };

  const filteredVisits = React.useMemo(() => {
    if (!searchQuery) return data.visits;

    const query = searchQuery.toLowerCase();
    return data.visits.filter((visit) => {
      const visitId = visit.id.toLowerCase();
      const appointmentType = (visit.appointmentType || "").toLowerCase();
      const priority = (visit.priority || "").toLowerCase();
      const status = (visit.status || "").toLowerCase();

      return (
        visitId.includes(query) ||
        appointmentType.includes(query) ||
        priority.includes(query) ||
        status.includes(query)
      );
    });
  }, [data.visits, searchQuery]);

  const getNewVisitPath = () => {
    return `/patients/${patientId}/new-visit`;
  };

  const totalPages = Math.ceil(data.total / data.pageSize);
  const hasNextPage = data.page < totalPages;
  const hasPrevPage = data.page > 1;

  // Summary counts
  const totalVisits = data.total;
  const inProgressCount = data.visits.filter((v) => {
    const s = (v.status || "").toLowerCase();
    return s === "in progress" || s === "in_progress";
  }).length;
  const signedCount = data.visits.filter((v) => {
    const s = (v.status || "").toLowerCase();
    return (
      v.status === "Signed & Complete" ||
      s === "signed" ||
      s === "completed" ||
      s === "signed & complete" ||
      s === "finalized" ||
      s === "signed_and_complete"
    );
  }).length;

  const summaryMetrics = [
    {
      k: "Total visits",
      v: totalVisits,
      icon: CalendarDays,
      tone: "var(--ink-3)" as const,
    },
    {
      k: "In progress",
      v: inProgressCount,
      icon: Clock,
      tone: "var(--brand-ink)" as const,
    },
    {
      k: "Signed & complete",
      v: signedCount,
      icon: CheckCircle2,
      tone: "var(--ok)" as const,
    },
    {
      k: "On this page",
      v: filteredVisits.length,
      icon: Filter,
      tone: "var(--ink-3)" as const,
    },
  ];

  // Group visits by date (YYYY-MM-DD)
  const groupedVisits = React.useMemo(() => {
    const groups = new Map<
      string,
      { label: string; visits: typeof filteredVisits }
    >();
    filteredVisits.forEach((v) => {
      const d = new Date(v.createdAt);
      const key = isNaN(d.getTime())
        ? "unknown"
        : d.toISOString().split("T")[0];
      const label = isNaN(d.getTime())
        ? "Unknown date"
        : d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          });
      if (!groups.has(key)) {
        groups.set(key, { label, visits: [] });
      }
      groups.get(key)!.visits.push(v);
    });
    return Array.from(groups.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      visits: val.visits,
    }));
  }, [filteredVisits]);

  const formatTimeOfDay = (date: Date | string) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <SubTabHeader
        eyebrow="Chart · Visit history"
        title="Visit history"
        subtitle="Review detailed medical encounters for this patient."
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => router.push(getNewVisitPath())}
          >
            Log new visit
          </Btn>
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
                borderRight: i < arr.length - 1 ? "1px solid var(--line)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--ink-3)" }}
                />
                <Input
                  placeholder="Search by visit ID, appointment type, priority, status..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
              <Btn kind="soft" type="submit">
                Search
              </Btn>
            </form>

            <div className="flex items-center gap-2">
              <Filter
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--ink-3)" }}
              />
              <Select value={currentStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="In Progress">In progress</SelectItem>
                  <SelectItem value="Waiting">Waiting</SelectItem>
                  <SelectItem value="Signed & Complete">Signed & complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--ink-3)" }}
                />
                <Input
                  type="date"
                  value={formatDateForInput(currentFrom)}
                  onChange={handleFromChange}
                  className="pl-9"
                />
              </div>
              <span
                className="mono text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
              >
                to
              </span>
              <div className="relative flex-1">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--ink-3)" }}
                />
                <Input
                  type="date"
                  value={formatDateForInput(currentTo)}
                  onChange={handleToChange}
                  className="pl-9"
                />
              </div>
            </div>

            <Btn
              kind="plain"
              size="sm"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={handleClearFilters}
            >
              Clear filters
            </Btn>
          </div>
        </div>
      </ClearingCard>

      {/* Visit list */}
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
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No visits matching your filters.
            </p>
            <Btn kind="soft" size="sm" onClick={handleClearFilters}>
              Clear all filters
            </Btn>
          </div>
        </ClearingCard>
      ) : (
        <>
          <ClearingCard pad={0}>
            <div>
              {groupedVisits.map((group, gi) => (
                <div
                  key={group.key}
                  style={{
                    borderBottom:
                      gi < groupedVisits.length - 1
                        ? "1px solid var(--line)"
                        : undefined,
                  }}
                >
                  <div
                    className="flex items-center gap-3 px-5 py-2.5"
                    style={{
                      background: "var(--paper-2)",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <CalendarDays
                      className="h-3.5 w-3.5"
                      style={{ color: "var(--ink-3)" }}
                    />
                    <div
                      className="text-[11px] uppercase"
                      style={{
                        color: "var(--ink-3)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {group.label}
                    </div>
                    <div className="flex-1" />
                    <span
                      className="mono text-[11px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {group.visits.length} visit
                      {group.visits.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div>
                    {group.visits.map((visit, i, arr) => {
                      return (
                        <Link
                          key={visit.id}
                          href={`/patients/${patientId}/visit-history/${visit.id}`}
                          className="group flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors"
                          style={{
                            borderBottom:
                              i < arr.length - 1
                                ? "1px solid var(--line)"
                                : undefined,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.background =
                              "var(--paper-2)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.background =
                              "transparent";
                          }}
                        >
                          <div
                            className="mono flex w-[88px] shrink-0 flex-col text-[12px]"
                            style={{ color: "var(--ink-2)" }}
                          >
                            <span style={{ color: "var(--ink)" }}>
                              {formatTimeOfDay(visit.createdAt)}
                            </span>
                            <span
                              className="text-[10.5px]"
                              style={{ color: "var(--ink-3)" }}
                            >
                              {formatDateTime(visit.createdAt)}
                            </span>
                          </div>

                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                            <div
                              className="text-[13.5px] font-medium"
                              style={{ color: "var(--ink)" }}
                            >
                              {visit.appointmentType === "in-person"
                                ? "In-person visit"
                                : visit.appointmentType === "virtual"
                                ? "Virtual visit"
                                : visit.appointmentType || "Visit"}
                            </div>

                            <Pill tone={visitStatusTone(visit.status)} dot>
                              {formatVisitStatusLabel(visit.status)}
                            </Pill>

                            {visit.priority && (
                              <Pill tone={priorityTone(visit.priority)}>
                                {visit.priority}
                              </Pill>
                            )}

                            <span
                              className="mono text-[11px]"
                              style={{ color: "var(--ink-3)" }}
                            >
                              {visit.id.slice(0, 8)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className="text-[12.5px] font-medium transition-colors"
                              style={{ color: "var(--ink-2)" }}
                            >
                              Open
                            </span>
                            <ChevronRight
                              className="h-4 w-4"
                              style={{ color: "var(--ink-3)" }}
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ClearingCard>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <div
                className="mono text-[12px]"
                style={{ color: "var(--ink-3)" }}
              >
                {data.total} records · page {data.page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Btn
                  kind="ghost"
                  size="sm"
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={!hasPrevPage}
                >
                  Prev
                </Btn>
                <span
                  className="mono inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px]"
                  style={{
                    background: "var(--ink)",
                    color: "var(--paper)",
                  }}
                >
                  {data.page}
                </span>
                <Btn
                  kind="ghost"
                  size="sm"
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={!hasNextPage}
                >
                  Next
                </Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
