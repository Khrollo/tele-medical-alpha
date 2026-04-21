"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Video,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  Clock,
  List as ListIcon,
  LayoutGrid as GridIcon,
} from "lucide-react";

import { assignVisitToMeAction } from "@/app/_actions/visits";
import { cn } from "@/app/_lib/utils/cn";
import { useWaitingRoomRealtime } from "@/app/_lib/hooks/use-waiting-room-realtime";

import { Avatar, Btn, ClearingCard, Pill, type PillTone } from "@/components/ui/clearing";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  avatarUrl: string | null;
  createdAt: Date | null;
  visit: VisitInfo | null;
}

interface WaitingRoomListProps {
  patients: Patient[];
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
type FilterKey = "all" | "critical" | "urgent" | "routine" | "virtual";

function getWaitMinutes(visit: VisitInfo | null): number {
  if (!visit?.createdAt) return 0;
  return Math.floor((Date.now() - new Date(visit.createdAt).getTime()) / 60000);
}

function formatWait(minutes: number): string {
  if (minutes <= 0) return "New";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function priorityKey(p: string | null): Exclude<FilterKey, "all" | "virtual"> | "none" {
  const k = (p ?? "").toLowerCase();
  if (k === "critical") return "critical";
  if (k === "urgent") return "urgent";
  if (k === "mild" || k === "low" || k === "routine") return "routine";
  return "none";
}

function priorityPill(p: string | null): { tone: PillTone; label: string; accent: string } {
  const key = priorityKey(p);
  if (key === "critical") return { tone: "critical", label: "Critical", accent: "var(--critical)" };
  if (key === "urgent") return { tone: "warn", label: "Urgent", accent: "var(--warn)" };
  if (key === "routine") return { tone: "info", label: "Routine", accent: "var(--info)" };
  return { tone: "neutral", label: p ?? "Not set", accent: "var(--line)" };
}

function appointmentPill(type: string | null): { tone: PillTone; label: string } {
  const t = (type ?? "").toLowerCase();
  if (t === "virtual") return { tone: "info", label: "Virtual" };
  if (t === "in-person" || t === "in person") return { tone: "neutral", label: "In-person" };
  return { tone: "neutral", label: type ?? "Not set" };
}

export function WaitingRoomList({ patients: initialPatients, userRole }: WaitingRoomListProps) {
  const router = useRouter();
  const [loadingPatientId, setLoadingPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("waitTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});

  const { patients, refresh } = useWaitingRoomRealtime({
    initialPatients,
    onError: (error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("Polling error:", error.message);
      }
    },
  });

  const counts = useMemo(() => {
    const c = { all: patients.length, critical: 0, urgent: 0, routine: 0, virtual: 0 };
    for (const p of patients) {
      const k = priorityKey(p.visit?.priority ?? null);
      if (k === "critical") c.critical++;
      if (k === "urgent") c.urgent++;
      if (k === "routine") c.routine++;
      if ((p.visit?.appointmentType ?? "").toLowerCase() === "virtual") c.virtual++;
    }
    return c;
  }, [patients]);

  const medianWaitMinutes = useMemo(() => {
    if (!patients.length) return 0;
    const sorted = [...patients].map((p) => getWaitMinutes(p.visit)).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  }, [patients]);

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
      if (visitId) await assignVisitToMeAction(visitId);
      navigateToVisitEditor(patientId, visitId);
    } catch (error) {
      console.error("Error assigning visit:", error);
      toast.error("Failed to assign visit");
    } finally {
      setLoadingPatientId(null);
    }
  };

  const filteredSorted = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const out = patients.filter((p) => {
      if (q) {
        const match =
          p.fullName.toLowerCase().includes(q) ||
          (p.visit?.priority?.toLowerCase().includes(q) ?? false) ||
          (p.visit?.appointmentType?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      if (filter === "all") return true;
      if (filter === "virtual") return (p.visit?.appointmentType ?? "").toLowerCase() === "virtual";
      return priorityKey(p.visit?.priority ?? null) === filter;
    });

    out.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case "name":
          aVal = a.fullName.toLowerCase();
          bVal = b.fullName.toLowerCase();
          break;
        case "waitTime":
          aVal = getWaitMinutes(a.visit);
          bVal = getWaitMinutes(b.visit);
          break;
        case "priority": {
          const order: Record<string, number> = { critical: 0, urgent: 1, routine: 2, none: 3 };
          aVal = order[priorityKey(a.visit?.priority ?? null)] ?? 999;
          bVal = order[priorityKey(b.visit?.priority ?? null)] ?? 999;
          break;
        }
        case "appointmentType":
          aVal = a.visit?.appointmentType?.toLowerCase() || "zzz";
          bVal = b.visit?.appointmentType?.toLowerCase() || "zzz";
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [patients, searchQuery, sortField, sortDirection, filter]);

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
    const topBarSearch = document.getElementById("waiting-room-search") as HTMLInputElement | null;
    if (!topBarSearch) return;
    const handleInput = (e: Event) => setSearchQuery((e.target as HTMLInputElement).value);
    topBarSearch.addEventListener("input", handleInput);
    if (topBarSearch.value !== searchQuery) topBarSearch.value = searchQuery;
    return () => topBarSearch.removeEventListener("input", handleInput);
  }, [searchQuery]);

  const today = new Date();
  const formattedDate = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
        <div>
          <div
            className="text-[11.5px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
          >
            {formattedDate}
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
            Waiting room
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            {userRole === "nurse"
              ? "Review today's assigned schedule and incoming visits."
              : "Review the physician schedule and assign incoming patient visits."}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Btn
            kind="ghost"
            size="sm"
            icon={<RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Syncing…" : "Auto-refresh on"}
          </Btn>
        </div>
      </div>

      {/* Summary strip */}
      <div
        className="grid overflow-hidden rounded-2xl"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        {[
          { k: "In queue", v: counts.all, sub: "patients waiting", color: "var(--ink)" },
          { k: "Critical", v: counts.critical, sub: "needs a clinician", color: "var(--critical)" },
          { k: "Urgent", v: counts.urgent, sub: "within 30 min", color: "oklch(0.5 0.12 70)" },
          { k: "Virtual", v: counts.virtual, sub: "telehealth visits", color: "var(--info)" },
          { k: "Median wait", v: formatWait(medianWaitMinutes), sub: "across queue", color: "var(--ok)" },
        ].map((m, i, arr) => (
          <div
            key={m.k}
            className="flex flex-col gap-1 px-6 py-5"
            style={{ borderRight: i < arr.length - 1 ? "1px solid var(--line)" : undefined }}
          >
            <div
              className="text-[11px] uppercase"
              style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
            >
              {m.k}
            </div>
            <div
              className="serif"
              style={{
                fontSize: 36,
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
                color: m.color,
              }}
            >
              {m.v}
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex gap-1 rounded-full p-1"
          style={{ border: "1px solid var(--line)", background: "var(--card)" }}
        >
          {([
            ["all", `All ${counts.all}`],
            ["critical", `Critical ${counts.critical}`],
            ["urgent", `Urgent ${counts.urgent}`],
            ["routine", `Routine ${counts.routine}`],
            ["virtual", `Virtual ${counts.virtual}`],
          ] as Array<[FilterKey, string]>).map(([k, label]) => {
            const active = filter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className="h-7 rounded-full px-3.5 text-[12.5px] font-medium tracking-tight transition-colors"
                style={{
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--paper)" : "var(--ink-2)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <div
          className="flex items-center gap-1 rounded-[10px] p-1"
          style={{ border: "1px solid var(--line)", background: "var(--card)" }}
        >
          {([
            ["list", <ListIcon key="li" className="h-3.5 w-3.5" />] as const,
            ["grid", <GridIcon key="gi" className="h-3.5 w-3.5" />] as const,
          ]).map(([k, icon]) => {
            const active = view === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                className="inline-flex h-6 w-8 items-center justify-center rounded-md transition-colors"
                style={{
                  background: active ? "var(--paper-3)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-3)",
                }}
                aria-label={`${k} view`}
              >
                {icon}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
          <span>Sort by</span>
          <Select value={sortField} onValueChange={(value) => handleSortChange(value as SortField)}>
            <SelectTrigger className="h-8 min-w-[140px] rounded-md text-[12px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="waitTime">Wait time</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="appointmentType">Type</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md"
            style={{ border: "1px solid var(--line)", color: "var(--ink-2)" }}
            aria-label="Reverse sort"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Queue */}
      <div
        className={cn(
          "gap-4",
          view === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col"
        )}
      >
        {filteredSorted.map((p) => {
          const wait = getWaitMinutes(p.visit);
          const pr = priorityPill(p.visit?.priority ?? null);
          const ap = appointmentPill(p.visit?.appointmentType ?? null);
          const isVirtualReady =
            (p.visit?.appointmentType ?? "").toLowerCase() === "virtual" &&
            p.visit?.status === "In Progress" &&
            !!p.visit?.patientJoinToken;
          const joinUrl =
            typeof window !== "undefined" && p.visit?.id
              ? `${window.location.origin}/visit/${p.visit.id}/call`
              : "";

          return (
            <ClearingCard
              key={p.id}
              pad={0}
              style={{
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                borderLeft: `3px solid ${pr.accent}`,
              }}
            >
              {/* Head */}
              <div className="flex items-start gap-3 px-4.5 py-3.5">
                <Avatar name={p.fullName} src={p.avatarUrl} size={40} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className="serif nowrap"
                      style={{ fontSize: 20, letterSpacing: "-0.015em", color: "var(--ink)" }}
                    >
                      {p.fullName}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Pill tone={pr.tone} dot>
                    {pr.label}
                  </Pill>
                  <Pill tone={ap.tone}>
                    {ap.label === "Virtual" ? <Video className="h-3 w-3" /> : null}
                    {ap.label}
                  </Pill>
                </div>
              </div>

              {/* Footer */}
              <div
                className="flex flex-wrap items-center gap-2.5 px-4.5 py-2.5"
                style={{
                  background: "var(--paper-2)",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  <Clock className="h-3.5 w-3.5" />
                  <span className="mono" style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {formatWait(wait)}
                  </span>
                </div>
                <div className="h-3.5 w-px" style={{ background: "var(--line)" }} />
                <div className="flex-1" />
                {isVirtualReady ? (
                  <VirtualAppointmentActions
                    joinUrl={joinUrl}
                    onJoin={() => router.push(`/visit/${p.visit?.id}/call`)}
                  />
                ) : (
                  <Btn
                    kind="accent"
                    size="sm"
                    disabled={loadingPatientId === p.id}
                    onClick={(e) => handleAssignToMe(p.id, p.visit?.id ?? null, e)}
                  >
                    {loadingPatientId === p.id ? "Assigning…" : "Assign to me"}
                  </Btn>
                )}
              </div>
            </ClearingCard>
          );
        })}

        {filteredSorted.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-16 text-center"
            style={{
              border: "1px dashed var(--line-strong)",
              color: "var(--ink-3)",
            }}
          >
            <RefreshCw className="h-5 w-5" />
            <p className="text-[13px]">
              {userRole === "nurse"
                ? "No patients currently scheduled or waiting."
                : "No patients currently scheduled or awaiting assignment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="flex flex-wrap items-center gap-1.5">
      <Btn kind="ghost" size="sm" icon={<QrCode className="h-3.5 w-3.5" />} onClick={() => setShowQR(true)}>
        QR
      </Btn>
      <Btn
        kind="ghost"
        size="sm"
        icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        onClick={handleCopy}
      >
        {copied ? "Copied" : "Copy link"}
      </Btn>
      <Btn kind="accent" size="sm" icon={<Video className="h-3.5 w-3.5" />} onClick={onJoin}>
        Join call
      </Btn>
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Doctor join link</DialogTitle>
            <DialogDescription>Scan this QR code or copy the link to join the call</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>
            <div className="w-full space-y-2">
              <Input value={joinUrl} readOnly className="text-xs" />
              <Btn kind="ghost" full size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" /> Copy link
                  </>
                )}
              </Btn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
