"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Search, X, CalendarDays, Clock, MapPin, ChevronRight, Filter, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/app/_lib/utils/cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VisitHistoryResult } from "@/app/_lib/db/drizzle/queries/visit-history";
import { formatDateTime } from "@/app/_lib/utils/format-date";
import { formatVisitStatusLabel } from "@/app/_lib/utils/visit-status-label";

interface VisitHistoryContentProps {
  patientId: string;
  userRole: string;
  data: VisitHistoryResult;
  searchQuery: string | null;
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

  // Get current filter values from URL
  const currentStatus = searchParams.get("status") || "all";
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";
  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  };

  // Update URL with new params
  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to page 1 when filters change
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

  // Client-side search filter (optional enhancement)
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

  // Get new visit path based on role
  const getNewVisitPath = () => {
    return `/patients/${patientId}/new-visit`;
  };

  // Calculate pagination
  const totalPages = Math.ceil(data.total / data.pageSize);
  const hasNextPage = data.page < totalPages;
  const hasPrevPage = data.page > 1;

  // Get status badge with color coding
  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return { variant: "secondary" as const, className: "" };
    }
    const statusLower = status.toLowerCase();
    
    // Handle both new and old status values for backward compatibility
    if (
      status === "Signed & Complete" ||
      statusLower === "signed" ||
      statusLower === "completed" ||
      statusLower === "signed & complete"
    ) {
      return {
        variant: "default" as const,
        className: "bg-green-500 text-white border-green-600 dark:bg-green-600",
      };
    }
    if (status === "Waiting" || statusLower === "waiting") {
      return {
        variant: "outline" as const,
        className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500 dark:border-blue-400",
      };
    }
    if (
      status === "In Progress" ||
      statusLower === "in_progress" ||
      statusLower === "in progress"
    ) {
      return {
        variant: "outline" as const,
        className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500 dark:border-yellow-400",
      };
    }
    if (statusLower === "draft") {
      return {
        variant: "secondary" as const,
        className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500 dark:border-gray-400",
      };
    }
    if (statusLower === "finalized" || statusLower === "signed_and_complete") {
      return {
        variant: "default" as const,
        className: "bg-green-500 text-white border-green-600 dark:bg-green-600",
      };
    }
    return { variant: "outline" as const, className: "" };
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-8 bg-slate-50/30 dark:bg-transparent">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Visit History</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Review detailed medical encounters for this patient.
          </p>
        </div>
        <Link href={getNewVisitPath()}>
          <Button className="rounded-full px-6 shadow-md">
            Log New Visit
          </Button>
        </Link>
      </div>

      {/* Filters Row */}
      <Card className="rounded-[1.5rem] border-none shadow-sm bg-white dark:bg-slate-900/50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            {/* Search and Status Row */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <form
                onSubmit={handleSearchSubmit}
                className="flex-1 flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by visit ID, location, priority, status..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-11 rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800"
                  />
                </div>
                <Button type="submit" variant="secondary" className="rounded-xl px-6">
                  Search
                </Button>
              </form>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={currentStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full sm:w-[200px] rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Waiting">Waiting</SelectItem>
                    <SelectItem value="Signed & Complete">Signed & Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range Row */}
            <div className="flex flex-col gap-4 sm:flex-row items-center justify-between pt-0 border-t-0">
               <div className="flex items-center gap-3 flex-1 w-full">
                  <div className="flex items-center gap-2 flex-1 relative">
                    <Calendar className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="date"
                      placeholder="From date"
                      value={formatDateForInput(currentFrom)}
                      onChange={handleFromChange}
                      className="pl-9 rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800 text-xs h-9"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">to</span>
                  <div className="flex items-center gap-2 flex-1 relative">
                    <Calendar className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      type="date"
                      placeholder="To date"
                      value={formatDateForInput(currentTo)}
                      onChange={handleToChange}
                      className="pl-9 rounded-xl bg-slate-50/50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800 text-xs h-9"
                    />
                  </div>
               </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-slate-400 hover:text-slate-600 hover:bg-transparent"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visit List */}
      {filteredVisits.length === 0 ? (
        <Card className="rounded-[2rem] border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium mb-6">No visits matching your filters.</p>
              <Button onClick={handleClearFilters} variant="outline" className="rounded-full">
                Clear all filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6">
            {filteredVisits.map((visit) => {
              const statusBadge = getStatusBadge(visit.status);
              return (
                <Link
                  key={visit.id}
                  href={`/patients/${patientId}/visit-history/${visit.id}`}
                  className="block"
                >
                  <Card className="rounded-[2rem] border-none shadow-[0_8px_30px_rgb(0,0,0,0.03)] bg-white dark:bg-slate-900 transition-all hover:translate-x-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] group cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                        {/* Time & Icon */}
                        <div className="flex items-center gap-4 lg:w-[220px] shrink-0">
                          <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform">
                            <CalendarDays className="h-6 w-6 text-slate-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</span>
                            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                              {formatDateTime(visit.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Status & Type */}
                        <div className="flex flex-wrap items-center gap-6 flex-1 min-w-0">
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clinical Status</span>
                            <Badge
                              variant={statusBadge.variant}
                              className={cn("rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-wider h-6", statusBadge.className)}
                            >
                              {formatVisitStatusLabel(visit.status)}
                            </Badge>
                          </div>

                          <div className="flex flex-col gap-1 shrink-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</span>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                               <Clock className="h-3.5 w-3.5 text-slate-400" />
                               {visit.appointmentType === "in-person" ? "Clinic" : "Virtual"}
                            </div>
                          </div>

                          {visit.priority && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-bold tracking-wider rounded-full px-3",
                                  visit.priority.toLowerCase() === "high" || visit.priority.toLowerCase() === "urgent"
                                    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                                    : visit.priority.toLowerCase() === "medium"
                                    ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
                                    : "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                                )}
                              >
                                {visit.priority}
                              </Badge>
                            </div>
                          )}

                        {/* Note: chiefComplaint is not in the schema for visits table currently */}
                        </div>

                        {/* Right: View Button */}
                        <div className="flex items-center justify-end lg:pl-4">
                           <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                              <ChevronRight className="h-5 w-5" />
                           </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6">
              <div className="text-sm font-medium text-slate-400">
                Found {data.total} records
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-4 hover:bg-slate-100 text-slate-600"
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={!hasPrevPage}
                >
                  Prev
                </Button>
                <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-md">
                   {data.page}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full px-4 hover:bg-slate-100 text-slate-600"
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={!hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

