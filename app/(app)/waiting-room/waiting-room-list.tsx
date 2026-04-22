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
  ChevronDown,
  QrCode,
  RefreshCw,
  Clock,
  List as ListIcon,
  LayoutGrid as GridIcon,
  Pill as PillIcon,
  AlertCircle,
} from "lucide-react";

import { assignVisitToMeAction } from "@/app/_actions/visits";
import { cn } from "@/app/_lib/utils/cn";
import { formatDate } from "@/app/_lib/utils/format-date";
import { useWaitingRoomRealtime } from "@/app/_lib/hooks/use-waiting-room-realtime";
import {
  deriveWorkflowChips,
  type WorkflowFlags,
} from "@/app/_lib/utils/patient-workflow-chips";

import { Avatar, Btn, ClearingCard, Pill, type PillTone } from "@/components/ui/clearing";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VisitInfo {
  id: string;
  priority: string | null;
  appointmentType: string | null;
  createdAt: Date;
  // Populated when a clinician has picked the visit up. Wait time is measured
  // from this timestamp (falls back to createdAt) so reassignment resets the
  // counter without mutating the canonical queue-entry time.
  assignedAt: Date | null;
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
  dob: string | null;
  allergiesCount: number;
  medicationsCount: number;
  createdAt: Date | null;
  visit: VisitInfo | null;
  workflow?: WorkflowFlags | null;
}

interface WaitingRoomListProps {
  patients: Patient[];
  userRole?: string;
}

type SortField = "name" | "waitTime" | "priority" | "appointmentType";
type SortDirection = "asc" | "desc";
type FilterKey = "all" | "critical" | "urgent" | "routine" | "virtual";

function getWaitMinutes(visit: VisitInfo | null): number {
  if (!visit) return 0;
  const reference = visit.assignedAt ?? visit.createdAt;
  if (!reference) return 0;
  return Math.floor((Date.now() - new Date(reference).getTime()) / 60000);
}

/** Duration-only label for top-of-page stats. Keeps an empty queue distinct from a fresh 0m wait. */
function formatWaitShort(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Per-card wait label. Distinguishes a newly-arrived patient from a
 * measured wait time (avoids the ambiguous lone "New"/"Wait" words).
 */
function formatWaitPhrase(minutes: number): string {
  if (minutes <= 0) return "Just arrived";
  if (minutes < 60) return `Waiting ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `Waiting ${h}h ${m}m` : `Waiting ${h}h`;
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  try {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
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
  // The old Dribbble-referenced urgent alert banner — and with it the
  // `acknowledgedAlerts` dismissal state — was removed in the Clearing
  // redesign. The banner no longer exists, so there is nothing to dismiss
  // and nothing to remember between reloads. If/when a dismissible alert
  // surface is reintroduced, it should persist to the server (see
  // engineering brief issue #10b), not to localStorage, so that dismissals
  // follow the clinician across devices.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (patientId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

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
    if (!patients.length) return null;
    const sorted = [...patients].map((p) => getWaitMinutes(p.visit)).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? null;
  }, [patients]);

  // One-time migration: scrub the orphaned `waiting-room-acknowledged-alerts`
  // key from localStorage. It was written by the old alert-banner logic and
  // is no longer read anywhere. Leaving it behind would silently resurface
  // stale dismissals if the banner feature is ever reintroduced with the
  // same key.
  React.useEffect(() => {
    try {
      window.localStorage.removeItem("waiting-room-acknowledged-alerts");
    } catch {
      // localStorage can throw in private browsing; the key is harmless.
    }
  }, []);

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

    // A card on the waiting-room board without a visit ID is a data bug — the
    // server-side queries only include patients that have an active Waiting /
    // In Progress visit. The old code silently navigated to a create-visit
    // URL, masking the bug and creating a phantom visit. Refuse the click
    // and surface the state instead so it's reported, not swallowed.
    if (!visitId) {
      console.error("handleAssignToMe: missing visitId for patient", patientId);
      toast.error("This card has no active visit — please refresh the queue");
      return;
    }

    setLoadingPatientId(patientId);
    try {
      const result = await assignVisitToMeAction(visitId);
      // Virtual-visit side effects (Twilio room, patient SMS/email) are
      // reported per-side-effect by the action. Surface them individually so
      // the clinician knows exactly what worked and what needs a manual
      // follow-up — previously these failed silently behind a generic
      // success toast.
      if (result?.warnings?.length) {
        for (const w of result.warnings) {
          toast.warning(w.message);
        }
      }
      navigateToVisitEditor(patientId, visitId);
    } catch (error) {
      console.error("Error assigning visit:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to assign visit";
      toast.error(message);
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
          (p.visit?.appointmentType?.toLowerCase().includes(q) ?? false) ||
          (p.visit?.chiefComplaint?.toLowerCase().includes(q) ?? false);
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
          { k: "Median wait", v: formatWaitShort(medianWaitMinutes), sub: "across queue", color: "var(--ok)" },
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
          const isExpanded = expandedIds.has(p.id);
          const age = calculateAge(p.dob);
          const snapshotPanelId = `waiting-room-snapshot-${p.id}`;
          const workflowChips = deriveWorkflowChips(p.workflow ?? null);

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
                <button
                  type="button"
                  onClick={() => toggleExpanded(p.id)}
                  aria-expanded={isExpanded}
                  aria-controls={snapshotPanelId}
                  aria-label={isExpanded ? `Hide snapshot for ${p.fullName}` : `Show snapshot for ${p.fullName}`}
                  className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--paper-2)]"
                  style={{ color: "var(--ink-2)" }}
                >
                  <ChevronDown
                    className="h-4 w-4 transition-transform"
                    style={{ transform: isExpanded ? "rotate(180deg)" : undefined }}
                  />
                </button>
              </div>

              {/* Always-visible workflow chips — vitals, labs, imaging, check-in */}
              {workflowChips.length > 0 && (
                <div
                  className="flex flex-wrap items-center gap-1.5 px-4.5 pb-3 pt-0"
                  style={{ marginTop: -4 }}
                >
                  {workflowChips.map((chip) => (
                    <Pill key={chip.key} tone={chip.tone} dot={chip.dot}>
                      {chip.label}
                    </Pill>
                  ))}
                </div>
              )}

              {/* Inline snapshot (accordion) */}
              {isExpanded && (
                <div
                  id={snapshotPanelId}
                  className="flex flex-col gap-2.5 px-4.5 pb-3.5 pt-0.5"
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  {p.visit?.chiefComplaint && (
                    <div className="pt-3">
                      <div
                        className="text-[10px] uppercase"
                        style={{ color: "var(--ink-3)", letterSpacing: "0.1em", fontWeight: 600 }}
                      >
                        Chief complaint
                      </div>
                      <div
                        className="text-[13px] leading-snug"
                        style={{ color: "var(--ink)" }}
                      >
                        {p.visit.chiefComplaint}
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]",
                      p.visit?.chiefComplaint ? "" : "pt-3"
                    )}
                    style={{ color: "var(--ink-2)" }}
                  >
                    {(age !== null || p.dob) && (
                      <span className="inline-flex items-center gap-1">
                        {age !== null && <span>{age} yrs</span>}
                        {age !== null && p.dob && <span style={{ color: "var(--ink-3)" }}>·</span>}
                        {p.dob && (
                          <span className="mono" style={{ color: "var(--ink-3)" }}>
                            {formatDate(p.dob)}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <PillIcon className="h-3.5 w-3.5" style={{ color: "var(--brand-ink)" }} />
                      <span>
                        {p.medicationsCount} med{p.medicationsCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <AlertCircle
                        className="h-3.5 w-3.5"
                        style={{ color: p.allergiesCount > 0 ? "var(--critical)" : "var(--ink-3)" }}
                      />
                      <span>
                        {p.allergiesCount} allerg{p.allergiesCount === 1 ? "y" : "ies"}
                      </span>
                    </span>
                  </div>
                </div>
              )}

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
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                    {formatWaitPhrase(wait)}
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
