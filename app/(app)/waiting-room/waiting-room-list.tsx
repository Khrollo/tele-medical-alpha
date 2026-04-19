"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignVisitToMeAction } from "@/app/_actions/visits";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ArrowUpDown, Check, Copy, QrCode, RefreshCw, Siren, User, Video } from "lucide-react";
import { cn } from "@/app/_lib/utils/cn";
import { QRCodeSVG } from "qrcode.react";
import { useWaitingRoomRealtime } from "@/app/_lib/hooks/use-waiting-room-realtime";

interface VisitInfo {
  id: string;
  priority: string | null;
  appointmentType: string | null;
  createdAt: Date;
  status: string | null;
  clinicianId: string | null;
  twilioRoomName: string | null;
  patientJoinToken: string | null;
  chiefComplaint: string | null;
}

interface Patient {
  id: string;
  fullName: string;
  createdAt: Date | null;
  visit: VisitInfo | null;
}

interface WaitingRoomListProps {
  patients: Patient[]; // Initial patients from server
  userRole?: string;
}

interface PatientSnapshot {
  patient: {
    fullName: string;
    dob: string | null;
    allergies: unknown;
    vitals: unknown;
    currentMedications: unknown;
    familyHistory: unknown;
    socialHistory: unknown;
    pastMedicalHistory: unknown;
  };
  latestVisit: {
    chiefComplaint?: string | null;
    appointmentType?: string | null;
    status?: string | null;
  } | null;
}

type SortField = "name" | "waitTime" | "priority" | "appointmentType";
type SortDirection = "asc" | "desc";

export function WaitingRoomList({ patients: initialPatients, userRole }: WaitingRoomListProps) {
  const router = useRouter();
  const [loadingPatientId, setLoadingPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("waitTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});
  const [snapshotPatientId, setSnapshotPatientId] = useState<string | null>(null);
  const [snapshotData, setSnapshotData] = useState<PatientSnapshot | null>(null);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);

  const [virtualVisitData] = useState<Record<string, { joinUrl: string; visitId: string }>>({});

  // Use polling hook to get live updates
  const { patients, refresh } = useWaitingRoomRealtime({
    initialPatients,
    onError: (error) => {
      // Only log errors, don't spam console
      // Errors are handled gracefully - the UI will show initial data
      if (process.env.NODE_ENV === "development") {
        console.warn("Polling error:", error.message);
      }
    },
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("waiting-room-acknowledged-alerts");
      if (saved) {
        setAcknowledgedAlerts(JSON.parse(saved) as Record<string, boolean>);
      }
    } catch {
      // Ignore local storage failures.
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        "waiting-room-acknowledged-alerts",
        JSON.stringify(acknowledgedAlerts)
      );
    } catch {
      // Ignore local storage failures.
    }
  }, [acknowledgedAlerts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const navigateToVisitEditor = (patientId: string, visitId?: string | null) => {
    const target = visitId
      ? `/patients/${patientId}/new-visit?visitId=${visitId}`
      : `/patients/${patientId}/new-visit`;

    // Use a full navigation so the edit surface loads from a fresh server render.
    window.location.assign(target);
  };

  const handleAssignToMe = async (
    patientId: string,
    visitId: string | null,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setLoadingPatientId(patientId);

    try {
      if (visitId) {
        await assignVisitToMeAction(visitId);
      }

      navigateToVisitEditor(patientId, visitId);
    } catch (error) {
      console.error("Error assigning visit:", error);
      toast.error("Failed to assign visit");
    } finally {
      setLoadingPatientId(null);
    }
  };

  // Calculate wait time in minutes
  const getWaitTime = (visit: VisitInfo | null): number => {
    if (!visit || !visit.createdAt) return 0;
    const now = new Date();
    const visitTime = new Date(visit.createdAt);
    const diffMs = now.getTime() - visitTime.getTime();
    return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
  };

  // Format wait time display
  const formatWaitTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get priority badge variant
  const getPriorityBadge = (priority: string | null) => {
    if (!priority) {
      return { variant: "secondary" as const, label: "Not Set" };
    }
    const priorityLower = priority.toLowerCase();
    if (priorityLower === "critical" || priorityLower === "urgent") {
      return {
        variant: "destructive" as const,
        label: priority,
        className: "bg-red-500 text-white border-red-600 dark:bg-red-600 dark:text-white"
      };
    }
    if (priorityLower === "mild" || priorityLower === "low") {
      return { variant: "default" as const, label: priority };
    }
    return { variant: "outline" as const, label: priority };
  };

  // Get appointment type badge
  const getAppointmentTypeBadge = (type: string | null) => {
    if (!type) {
      return { variant: "secondary" as const, label: "Not Set" };
    }
    const typeLower = type.toLowerCase();
    if (typeLower === "in-person" || typeLower === "in person") {
      return { variant: "default" as const, label: "In-Person", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500" };
    }
    if (typeLower === "virtual") {
      return { variant: "default" as const, label: "Virtual", className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500" };
    }
    return { variant: "outline" as const, label: type };
  };

  const formatScheduledTime = (visit: VisitInfo | null) => {
    if (!visit?.createdAt) {
      return "Unscheduled";
    }

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(visit.createdAt));
  };

  const getArrivalStatusBadge = (status: string | null) => {
    const normalized = status?.toLowerCase();
    if (normalized === "waiting") {
      return {
        label: "Arrived",
        className:
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
      };
    }

    if (normalized === "in progress" || normalized === "in_progress") {
      return {
        label: "Roomed",
        className:
          "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40",
      };
    }

    return {
      label: "Pending",
      className:
        "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/40",
    };
  };

  const getSlotTypeBadge = (visit: VisitInfo | null) => {
    if (visit?.clinicianId) {
      return {
        label: "Designated",
        className:
          "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/40",
      };
    }

    return {
      label: "Free Slot",
      className:
        "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/40",
    };
  };

  const formatHistorySummary = (entries: unknown, emptyLabel: string) => {
    if (entries && typeof entries === "object" && !Array.isArray(entries)) {
      return Object.entries(entries as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string" && value)
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ") || emptyLabel;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return emptyLabel;
    }

    return entries
      .slice(0, 3)
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          return (
            (typeof record.condition === "string" && record.condition) ||
            (typeof record.relationship === "string" && record.relationship) ||
            (typeof record.brandName === "string" && record.brandName) ||
            (typeof record.name === "string" && record.name) ||
            (typeof record.status === "string" && record.status) ||
            "Not specified"
          );
        }

        return "Not specified";
      })
      .join(", ");
  };

  const handleAlertAcknowledged = (patientId: string, visitId?: string | null) => {
    const key = `${patientId}:${visitId ?? "no-visit"}`;
    setAcknowledgedAlerts((current) => ({
      ...current,
      [key]: true,
    }));
    toast.success("Urgent alert acknowledged");
  };

  const openSnapshot = async (patientId: string) => {
    setSnapshotPatientId(patientId);
    setIsSnapshotLoading(true);
    setSnapshotData(null);

    try {
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) {
        throw new Error("Unable to load patient snapshot");
      }

      const data = (await response.json()) as PatientSnapshot;
      setSnapshotData(data);
    } catch (error) {
      console.error("Error loading patient snapshot:", error);
      toast.error("Unable to load patient snapshot");
    } finally {
      setIsSnapshotLoading(false);
    }
  };

  // Filter and sort patients
  const filteredAndSortedPatients = useMemo(() => {
    const selectedDateKey = selectedDate.toDateString();
    const filtered = patients.filter(patient => {
      const visitDate = patient.visit?.createdAt
        ? new Date(patient.visit.createdAt).toDateString()
        : patient.createdAt
          ? new Date(patient.createdAt).toDateString()
          : "";

      if (visitDate !== selectedDateKey) {
        return false;
      }

      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        patient.fullName.toLowerCase().includes(query) ||
        (patient.visit?.priority?.toLowerCase().includes(query) ?? false) ||
        (patient.visit?.appointmentType?.toLowerCase().includes(query) ?? false) ||
        (patient.visit?.chiefComplaint?.toLowerCase().includes(query) ?? false)
      );
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = a.fullName.toLowerCase();
          bValue = b.fullName.toLowerCase();
          break;
        case "waitTime":
          aValue = getWaitTime(a.visit);
          bValue = getWaitTime(b.visit);
          break;
        case "priority":
          aValue = a.visit?.priority?.toLowerCase() || "zzz";
          bValue = b.visit?.priority?.toLowerCase() || "zzz";
          // Custom priority order: critical > urgent > mild > others
          const priorityOrder: Record<string, number> = { critical: 0, urgent: 1, mild: 2 };
          aValue = priorityOrder[aValue as string] ?? 999;
          bValue = priorityOrder[bValue as string] ?? 999;
          break;
        case "appointmentType":
          aValue = a.visit?.appointmentType?.toLowerCase() || "zzz";
          bValue = b.visit?.appointmentType?.toLowerCase() || "zzz";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [patients, searchQuery, selectedDate, sortField, sortDirection]);

  const urgentAlerts = useMemo(() => {
    return filteredAndSortedPatients.filter((patient) => {
      const isUrgent =
        patient.visit?.priority?.toLowerCase() === "critical" ||
        patient.visit?.priority?.toLowerCase() === "urgent";
      const ackKey = `${patient.id}:${patient.visit?.id ?? "no-visit"}`;
      return isUrgent && !acknowledgedAlerts[ackKey];
    });
  }, [acknowledgedAlerts, filteredAndSortedPatients]);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sync search with top bar search input
  React.useEffect(() => {
    const topBarSearch = document.getElementById("waiting-room-search") as HTMLInputElement;
    if (topBarSearch) {
      const handleInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        setSearchQuery(target.value);
      };
      topBarSearch.addEventListener("input", handleInput);
      // Sync initial value
      if (topBarSearch.value !== searchQuery) {
        topBarSearch.value = searchQuery;
      }
      return () => {
        topBarSearch.removeEventListener("input", handleInput);
      };
    }
  }, [searchQuery]);

  // Update top bar search when searchQuery changes (for external updates)
  React.useEffect(() => {
    const topBarSearch = document.getElementById("waiting-room-search") as HTMLInputElement;
    if (topBarSearch && topBarSearch.value !== searchQuery) {
      topBarSearch.value = searchQuery;
    }
  }, [searchQuery]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header Area */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Schedule
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {userRole === "nurse"
              ? "Review today’s assigned schedule and incoming visits."
              : "Review the physician schedule and assign incoming patient visits."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 dark:border-slate-800 dark:bg-slate-900">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() =>
                setSelectedDate((current) => {
                  const next = new Date(current);
                  next.setDate(current.getDate() - 1);
                  return next;
                })
              }
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Previous day</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full px-3 text-xs font-semibold uppercase tracking-wider"
              onClick={() => setSelectedDate(new Date())}
            >
              {selectedDate.toDateString() === new Date().toDateString()
                ? "Today"
                : selectedDate.toLocaleDateString()}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() =>
                setSelectedDate((current) => {
                  const next = new Date(current);
                  next.setDate(current.getDate() + 1);
                  return next;
                })
              }
            >
              <ArrowRight className="h-4 w-4" />
              <span className="sr-only">Next day</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-full px-4 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 transition-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 text-slate-500 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{isRefreshing ? "Syncing..." : "Sync"}</span>
          </Button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Select value={sortField} onValueChange={(value) => handleSortChange(value as SortField)}>
              <SelectTrigger className="w-[160px] h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-100 text-xs font-bold uppercase tracking-widest">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="waitTime">Wait Time</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="appointmentType">Appointment Type</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border border-slate-100 bg-white dark:bg-slate-900"
              onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            >
              <ArrowUpDown className="h-4 w-4 text-slate-600" />
            </Button>
          </div>
        </div>
      </div>

      {urgentAlerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {urgentAlerts.map((patient) => (
            <Card key={`alert:${patient.id}`} className="border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                    <Siren className="h-4 w-4" />
                    Critical alert
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {patient.fullName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {patient.visit?.priority || "Urgent priority"} •{" "}
                    {patient.visit?.chiefComplaint || "Chief complaint pending"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 bg-white/80 dark:border-red-800 dark:bg-slate-950"
                  onClick={() => handleAlertAcknowledged(patient.id, patient.visit?.id)}
                >
                  Acknowledge
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Patient Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filteredAndSortedPatients.map((patient) => {
          const waitTime = getWaitTime(patient.visit);
          const priorityBadge = getPriorityBadge(patient.visit?.priority ?? null);
          const appointmentBadge = getAppointmentTypeBadge(patient.visit?.appointmentType ?? null);
          const arrivalBadge = getArrivalStatusBadge(patient.visit?.status ?? null);
          const slotTypeBadge = getSlotTypeBadge(patient.visit);
          const isUrgent = patient.visit?.priority?.toLowerCase() === "critical" || patient.visit?.priority?.toLowerCase() === "urgent";

          return (
            <Card
              key={patient.id}
              className={cn(
                "group relative rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all hover:shadow-md hover:translate-y-[-2px]",
                isUrgent && "ring-2 ring-red-500/10"
              )}
            >
              {isUrgent && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500/50" />
              )}
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center min-w-[56px]">
                     <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Wait</span>
                     <span className={cn(
                       "text-sm font-medium",
                       waitTime > 30 ? "text-red-500" : waitTime > 15 ? "text-orange-500" : "text-slate-700 dark:text-slate-200"
                     )}>
                       {waitTime > 0 ? formatWaitTime(waitTime) : "NEW"}
                     </span>
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">
                    {patient.fullName}
                  </h3>
                  <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                    {patient.visit?.chiefComplaint || "Chief complaint pending"}
                  </div>
                  <div className="mb-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Time:
                      </span>{" "}
                      {formatScheduledTime(patient.visit)}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Arrival:
                      </span>{" "}
                      {arrivalBadge.label}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant={priorityBadge.variant}
                      className={cn(
                        "rounded-full px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider h-5",
                        priorityBadge.className
                      )}
                    >
                      {priorityBadge.label}
                    </Badge>
                    <Badge
                      variant={appointmentBadge.variant}
                      className={cn(
                        "rounded-full px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider h-5",
                        appointmentBadge.className
                      )}
                    >
                      {appointmentBadge.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider h-5",
                        arrivalBadge.className
                      )}
                    >
                      {arrivalBadge.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider h-5",
                        slotTypeBadge.className
                      )}
                    >
                      {slotTypeBadge.label}
                    </Badge>
                  </div>
                </div>

                {/* Show virtual appointment actions if ready */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <span className="font-semibold uppercase tracking-wider">
                      Snapshot
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => openSnapshot(patient.id)}
                    >
                      View
                    </Button>
                  </div>
                  {(virtualVisitData[patient.id] ||
                    (patient.visit?.appointmentType?.toLowerCase() === "virtual" &&
                      patient.visit?.status === "In Progress" &&
                      patient.visit?.patientJoinToken)) ? (
                    <VirtualAppointmentActions
                      joinUrl={
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/visit/${virtualVisitData[patient.id]?.visitId || patient.visit?.id || ""}/call`
                          : ""
                      }
                      onJoin={() => router.push(`/visit/${virtualVisitData[patient.id]?.visitId || patient.visit?.id || ""}/call`)}
                    />
                  ) : (
                    <Button
                      onClick={(e) => handleAssignToMe(patient.id, patient.visit?.id ?? null, e)}
                      className="w-full"
                      variant={isUrgent ? "default" : "secondary"}
                      disabled={loadingPatientId === patient.id}
                    >
                      {loadingPatientId === patient.id ? "Assigning..." : "Assign To Me"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAndSortedPatients.length === 0 && (
        <Card className="rounded-2xl border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="h-12 w-12 bg-white dark:bg-slate-900 rounded-full border border-slate-100 flex items-center justify-center mx-auto mb-3">
                 <RefreshCw className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">
                {userRole === "nurse"
                  ? "No patients currently scheduled or waiting."
                  : "No patients currently scheduled or awaiting assignment."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={snapshotPatientId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSnapshotPatientId(null);
            setSnapshotData(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Patient Snapshot</DialogTitle>
            <DialogDescription>
              Quick chart context without leaving the schedule board.
            </DialogDescription>
          </DialogHeader>
          {isSnapshotLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading patient snapshot...
            </div>
          ) : snapshotData ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">Patient</div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">
                    {snapshotData.patient.fullName}
                  </div>
                  <div>DOB: {snapshotData.patient.dob || "Not recorded"}</div>
                  <div>
                    Chief complaint:{" "}
                    {snapshotData.latestVisit?.chiefComplaint || "Pending"}
                  </div>
                  <div>
                    Visit type:{" "}
                    {snapshotData.latestVisit?.appointmentType || "Not specified"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold">Vitals / risks</div>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <div>
                    Latest vitals:{" "}
                    {formatHistorySummary(
                      snapshotData.patient.vitals as unknown[],
                      "No vitals captured"
                    )}
                  </div>
                  <div>
                    Allergies:{" "}
                    {formatHistorySummary(
                      snapshotData.patient.allergies as unknown[],
                      "No allergies recorded"
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4 md:col-span-2">
                <div className="text-sm font-semibold">Clinical context</div>
                <div className="mt-2 grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
                  <div>
                    Medications:{" "}
                    {formatHistorySummary(
                      snapshotData.patient.currentMedications as unknown[],
                      "No medications on file"
                    )}
                  </div>
                  <div>
                    PMH:{" "}
                    {formatHistorySummary(
                      snapshotData.patient.pastMedicalHistory as unknown[],
                      "No PMH on file"
                    )}
                  </div>
                  <div>
                    Social/Family:{" "}
                    {formatHistorySummary(
                      [
                        ...(Array.isArray(snapshotData.patient.socialHistory)
                          ? snapshotData.patient.socialHistory
                          : []),
                        ...(Array.isArray(snapshotData.patient.familyHistory)
                          ? snapshotData.patient.familyHistory
                          : []),
                      ],
                      "No social or family concerns on file"
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No patient snapshot available.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Virtual Appointment Actions Component
function VirtualAppointmentActions({
  joinUrl,
  onJoin,
}: {
  joinUrl: string;
  onJoin: () => void;
}) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <Button onClick={onJoin} className="w-full" variant="default">
        <Video className="h-4 w-4 mr-2" />
        Join Call
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setShowQR(true)}
          variant="outline"
          className="rounded-xl h-10 font-bold"
          size="sm"
        >
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </Button>
        <Button
          onClick={handleCopy}
          variant="outline"
          className="rounded-xl h-10 font-bold"
          size="sm"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </>
          )}
        </Button>
      </div>
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Doctor Join Link</DialogTitle>
            <DialogDescription>
              Scan this QR code or copy the link to join the call
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-lg">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <div className="w-full space-y-2">
              <Input value={joinUrl} readOnly className="text-xs" />
              <Button onClick={handleCopy} variant="outline" className="w-full" size="sm">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
