"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ClipboardList,
  Copy,
  FileText,
  FlaskConical,
  Heart,
  History,
  Pill as PillIcon,
  Video,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Btn,
  ClearingCard,
  Pill,
  Sparkline,
  type PillTone,
} from "@/components/ui/clearing";

interface PatientOverviewCardsProps {
  patient: {
    id: string;
    fullName: string;
    dob: string | null;
    allergies: unknown;
    vitals: unknown;
    currentMedications: unknown;
    vaccines: unknown;
    familyHistory: unknown;
    socialHistory: unknown;
    pastMedicalHistory: unknown;
    surgicalHistory: unknown;
  };
  stats: {
    ordersCount: number;
    documentsCount: number;
  };
  latestVisit: {
    id: string;
    createdAt: Date;
    status: string | null;
    notesStatus: string | null;
    appointmentType: string | null;
    clinicianId: string | null;
    patientJoinToken: string | null;
    twilioRoomName: string | null;
    chiefComplaint: string | null;
  } | null;
  recentVisits: Array<{
    id: string;
    createdAt: Date;
    status: string | null;
    appointmentType: string | null;
  }>;
  recentResults?: Array<{
    type: string;
    status: string;
    priority: string;
    details: string;
    dateOrdered: string;
    visitDate: Date;
  }>;
  userRole: string;
}

function resultStatusTone(status: string): PillTone {
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (["resulted", "complete", "completed", "done", "received", "final"].includes(s)) {
    return "ok";
  }
  if (["ordered", "collected", "pending", "in progress", "awaiting", "draft"].includes(s)) {
    return "warn";
  }
  return "neutral";
}

function formatResultStatus(status: string): string {
  const s = status.trim();
  if (!s) return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

type Allergy = { name?: string; type?: string; severity?: string; reaction?: string };
type Medication = {
  brandName?: string;
  genericName?: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  status?: string;
};
type HistoryItem = { condition?: string; status?: string; diagnosedDate?: string };
type VitalsEntry = {
  date?: string;
  bp?: string;
  hr?: string;
  temp?: string;
  weight?: string;
  spo2?: string;
  rr?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}
function normalizeList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  if (Array.isArray(data.entries)) return data.entries.filter(isRecord);
  return Object.values(data).filter(isRecord);
}
function normalizeAllergies(data: unknown): Allergy[] {
  if (Array.isArray(data)) {
    if (data.every(isRecord)) return data as Allergy[];
    return data.filter(asNonEmptyString).map<Allergy>((entry) => ({ name: entry.trim() }));
  }
  return normalizeList(data) as Allergy[];
}
function normalizeMedications(data: unknown): Medication[] {
  if (Array.isArray(data)) {
    if (data.every(isRecord)) return data as Medication[];
    return data.filter(asNonEmptyString).map<Medication>((entry) => ({ name: entry.trim() }));
  }
  return normalizeList(data) as Medication[];
}
function normalizeVitals(data: unknown): VitalsEntry[] {
  if (Array.isArray(data)) return data.filter(isRecord) as VitalsEntry[];
  if (!isRecord(data)) return [];
  if (Array.isArray(data.entries)) return data.entries.filter(isRecord) as VitalsEntry[];
  if (
    "bp" in data ||
    "hr" in data ||
    "temp" in data ||
    "weight" in data ||
    "spo2" in data ||
    "rr" in data
  ) {
    return [data] as VitalsEntry[];
  }
  return Object.values(data).filter(
    (v) => isRecord(v) && ("bp" in v || "hr" in v || "temp" in v || "weight" in v)
  ) as VitalsEntry[];
}
function normalizeJsonb(data: unknown): unknown[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") return Object.values(data);
  return [];
}

function allergySeverityTone(sev?: string): PillTone {
  const s = (sev ?? "").toLowerCase();
  if (s.includes("severe") || s.includes("anaphyl")) return "critical";
  if (s.includes("moderate")) return "warn";
  return "neutral";
}

function medStatusTone(status?: string): "ok" | "warn" {
  const s = (status ?? "").toLowerCase();
  return s.includes("held") || s.includes("prn") ? "warn" : "ok";
}

export function PatientOverviewCards({
  patient,
  stats,
  latestVisit,
  recentVisits,
  recentResults,
}: PatientOverviewCardsProps) {
  const router = useRouter();
  const [showVirtualModal, setShowVirtualModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const isVirtualVisitReady = () => {
    if (!latestVisit) return false;
    const s = latestVisit.status?.toLowerCase() || "";
    if (s === "signed & complete" || s === "completed") return false;
    return (
      latestVisit.appointmentType?.toLowerCase() === "virtual" &&
      latestVisit.clinicianId !== null &&
      latestVisit.patientJoinToken !== null
    );
  };

  const getJoinUrl = () => {
    if (!latestVisit?.patientJoinToken) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/join/${latestVisit.patientJoinToken}`;
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getJoinUrl());
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinCall = () => {
    const joinUrl = getJoinUrl();
    if (joinUrl) router.push(joinUrl);
  };

  const allergies = normalizeAllergies(patient.allergies);
  const medications = normalizeMedications(patient.currentMedications);
  const vitalsArray = normalizeVitals(patient.vitals).filter((v) => v.date);
  const pastMedicalHistory = normalizeJsonb(patient.pastMedicalHistory) as HistoryItem[];

  const sortedVitals = [...vitalsArray].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });
  const latestVital = sortedVitals[sortedVitals.length - 1];

  const seriesFor = (
    extractor: (v: VitalsEntry) => number | null
  ): { series: number[]; latest: string | null } => {
    const nums = sortedVitals
      .map(extractor)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const latest = extractor(latestVital ?? {});
    return {
      series: nums,
      latest: typeof latest === "number" && Number.isFinite(latest) ? `${latest}` : null,
    };
  };

  const systolic = seriesFor((v) =>
    v.bp?.includes("/") ? Number.parseFloat(v.bp.split("/")[0]) : NaN
  );
  const hr = seriesFor((v) => (v.hr ? Number.parseFloat(v.hr) : NaN));
  const temp = seriesFor((v) => (v.temp ? Number.parseFloat(v.temp) : NaN));
  const spo2 = seriesFor((v) => (v.spo2 ? Number.parseFloat(v.spo2) : NaN));
  const weight = seriesFor((v) => (v.weight ? Number.parseFloat(v.weight) : NaN));
  const rr = seriesFor((v) => (v.rr ? Number.parseFloat(v.rr) : NaN));

  const vitalCells: Array<{ k: string; v: string; u: string; series: number[] }> = [
    { k: "BP", v: latestVital?.bp ?? "—", u: "mmHg", series: systolic.series },
    { k: "HR", v: hr.latest ?? "—", u: "bpm", series: hr.series },
    { k: "Temp", v: temp.latest ?? "—", u: "°F", series: temp.series },
    { k: "SpO₂", v: spo2.latest ?? "—", u: "%", series: spo2.series },
    { k: "Weight", v: weight.latest ?? "—", u: "lb", series: weight.series },
    { k: "Resp", v: rr.latest ?? "—", u: "/min", series: rr.series },
  ];

  const lastReading = latestVital?.date
    ? new Date(latestVital.date).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col gap-5 px-4 py-6 pb-10 md:px-8 md:py-8">
      {/* Vitals strip */}
        <ClearingCard pad={0}>
          <div
            className="flex flex-wrap items-center gap-2.5 px-5 py-4"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <Heart className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
            <div className="serif" style={{ fontSize: 18, letterSpacing: "-0.01em", color: "var(--ink)" }}>
              Vitals
            </div>
            {lastReading && (
              <Pill tone="ok" dot>
                Last reading
              </Pill>
            )}
            <div className="flex-1" />
            <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
              {lastReading ? `${lastReading}` : "No vitals recorded"}
            </div>
            <Link href={`/patients/${patient.id}/vitals`} className="shrink-0">
              <Btn kind="plain" size="sm">
                View trend
              </Btn>
            </Link>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}
          >
            {vitalCells.map((x, i, arr) => (
              <div
                key={x.k}
                className="px-5 py-4"
                style={{ borderRight: i < arr.length - 1 ? "1px solid var(--line)" : undefined }}
              >
                <div
                  className="text-[10.5px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.08em" }}
                >
                  {x.k}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className="serif"
                    style={{
                      fontSize: 26,
                      lineHeight: 1,
                      letterSpacing: "-0.015em",
                      color: "var(--ink)",
                    }}
                  >
                    {x.v}
                  </span>
                  <span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                    {x.u}
                  </span>
                </div>
                <div className="mt-2">
                  {x.series.length > 1 ? (
                    <Sparkline data={x.series} w={110} h={24} />
                  ) : (
                    <div className="h-6 rounded-sm" style={{ background: "var(--paper-2)" }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </ClearingCard>

        {/* Row: Meds / Allergies+Risks / Recent visits */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Medications */}
          <ClearingCard pad={0}>
            <div
              className="flex items-center gap-2 px-4 py-3.5"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <PillIcon className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
              <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                Medications
              </div>
              <Pill tone="neutral" className="ml-auto">
                {medications.length} active
              </Pill>
            </div>
            <div>
              {medications.length === 0 ? (
                <div className="px-4 py-6 text-[13px]" style={{ color: "var(--ink-3)" }}>
                  No active medications.
                </div>
              ) : (
                medications.slice(0, 6).map((m, i, arr) => {
                  const tone = medStatusTone(m.status);
                  return (
                    <div
                      key={`${m.brandName ?? m.name ?? ""}-${i}`}
                      className="px-4 py-2.5"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : undefined }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: tone === "warn" ? "var(--warn)" : "var(--ok)" }}
                        />
                        <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                          {m.brandName || m.genericName || m.name || "Medication"}
                        </span>
                      </div>
                      {(m.dosage || m.frequency) && (
                        <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-2)" }}>
                          {[m.dosage, m.frequency].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2.5">
              <Link href={`/patients/${patient.id}/medications`}>
                <Btn kind="plain" size="sm">
                  Manage medications
                </Btn>
              </Link>
            </div>
          </ClearingCard>

          {/* Allergies + Risks */}
          <div className="flex flex-col gap-5">
            <ClearingCard>
              <div className="mb-2.5 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: "var(--critical)" }} />
                <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                  Allergies
                </div>
                <Pill
                  tone={allergies.length > 0 ? "critical" : "neutral"}
                  dot={allergies.length > 0}
                  className="ml-auto"
                >
                  {allergies.length > 0 ? `${allergies.length} active` : "None"}
                </Pill>
              </div>
              {allergies.length === 0 ? (
                <div className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                  No known drug allergies.
                </div>
              ) : (
                allergies.slice(0, 4).map((a, i) => {
                  const tone = allergySeverityTone(a.severity ?? a.type);
                  return (
                    <div
                      key={`${a.name ?? "unknown"}-${i}`}
                      className="flex gap-2.5 py-2"
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 3,
                          alignSelf: "stretch",
                          borderRadius: 4,
                          background: tone === "critical" ? "var(--critical)" : "var(--warn)",
                        }}
                      />
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                          {a.name ?? "Unknown"}
                        </div>
                        <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                          {[a.reaction, a.severity, a.type].filter(Boolean).join(" · ") || "No details recorded"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </ClearingCard>

            <ClearingCard>
              <div className="mb-2.5 flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: "var(--warn)" }} />
                <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                  Risk flags
                </div>
              </div>
              {pastMedicalHistory.length === 0 ? (
                <div className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                  No documented risk factors.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pastMedicalHistory.slice(0, 8).map((pmh, i) => (
                    <Pill
                      key={`${pmh.condition ?? "cond"}-${i}`}
                      tone={(pmh.status ?? "").toLowerCase() === "active" ? "warn" : "neutral"}
                    >
                      {pmh.condition ?? "Unknown"}
                    </Pill>
                  ))}
                </div>
              )}
            </ClearingCard>
          </div>

          {/* Recent visits */}
          <ClearingCard pad={0}>
            <div
              className="flex items-center gap-2 px-4 py-3.5"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <History className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
              <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                Recent visits
              </div>
              <Link href={`/patients/${patient.id}/visit-history`} className="ml-auto">
                <Btn kind="plain" size="sm">
                  All visits
                </Btn>
              </Link>
            </div>
            {recentVisits.length === 0 ? (
              <div className="px-4 py-6 text-[13px]" style={{ color: "var(--ink-3)" }}>
                No visits recorded.
              </div>
            ) : (
              recentVisits.slice(0, 4).map((v, i, arr) => (
                <Link
                  key={v.id}
                  href={`/patients/${patient.id}/visit-history?visitId=${v.id}`}
                  className="block px-4 py-2.5 transition-colors"
                  style={{
                    borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : undefined,
                    color: "var(--ink)",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "var(--paper-2)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="mono text-[11px]" style={{ color: "var(--ink-3)", minWidth: 86 }}>
                      {new Date(v.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                      {v.appointmentType || "Visit"}
                    </span>
                  </div>
                  <div className="text-[11.5px]" style={{ color: "var(--ink-3)", paddingLeft: 94 }}>
                    {v.status || "—"}
                  </div>
                </Link>
              ))
            )}
            {isVirtualVisitReady() && (
              <div className="flex justify-end p-3">
                <Btn
                  kind="accent"
                  size="sm"
                  icon={<Video className="h-3.5 w-3.5" />}
                  onClick={() => setShowVirtualModal(true)}
                >
                  Join virtual visit
                </Btn>
              </div>
            )}
          </ClearingCard>
        </div>

        {/* Labs & Imaging — most recent results (Kejhawn ask: surface these on the card). */}
        <ClearingCard pad={0}>
          <div
            className="flex items-center gap-2 px-4 py-3.5"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <FlaskConical className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Labs & imaging
            </div>
            <Pill
              tone={(recentResults?.length ?? 0) > 0 ? "info" : "neutral"}
              className="ml-auto"
            >
              {(recentResults?.length ?? 0) > 0
                ? `${recentResults!.length} recent`
                : "None"}
            </Pill>
            <Link href={`/patients/${patient.id}/labs-results`}>
              <Btn kind="plain" size="sm">
                View all
              </Btn>
            </Link>
          </div>
          {(recentResults?.length ?? 0) === 0 ? (
            <div className="px-4 py-6 text-[13px]" style={{ color: "var(--ink-3)" }}>
              No lab or imaging items documented yet.
            </div>
          ) : (
            recentResults!.slice(0, 5).map((result, i, arr) => {
              const tone = resultStatusTone(result.status);
              const displayDate = result.dateOrdered
                ? new Date(result.dateOrdered).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : new Date(result.visitDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
              return (
                <div
                  key={`${result.type}-${result.dateOrdered || result.visitDate}-${i}`}
                  className="flex flex-wrap items-center gap-2.5 px-4 py-2.5"
                  style={{
                    borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : undefined,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[13px] font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {result.type || "Order"}
                    </div>
                    {result.details && (
                      <div
                        className="truncate text-[11.5px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {result.details}
                      </div>
                    )}
                  </div>
                  <span className="mono text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {displayDate}
                  </span>
                  <Pill tone={tone} dot={tone === "warn"}>
                    {formatResultStatus(result.status)}
                  </Pill>
                </div>
              );
            })
          )}
        </ClearingCard>

        {/* Row: Orders + Documents */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ClearingCard>
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
              <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                Pending orders
              </div>
              <Pill
                tone={stats.ordersCount > 0 ? "warn" : "neutral"}
                className="ml-auto"
              >
                {stats.ordersCount > 0 ? `${stats.ordersCount} awaiting` : "None"}
              </Pill>
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              {stats.ordersCount > 0 ? (
                <Link
                  href={`/patients/${patient.id}/orders`}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  View all orders →
                </Link>
              ) : (
                "No pending orders."
              )}
            </div>
          </ClearingCard>

          <ClearingCard>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
              <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
                Documents
              </div>
              <Pill tone="neutral" className="ml-auto">
                {stats.documentsCount} on file
              </Pill>
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              <Link
                href={`/patients/${patient.id}/documents`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium"
                style={{ color: "var(--ink)" }}
              >
                Open document library →
              </Link>
            </div>
          </ClearingCard>
        </div>

      {showVirtualModal && isVirtualVisitReady() && (
        <Dialog open={showVirtualModal} onOpenChange={setShowVirtualModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Virtual visit — patient join link</DialogTitle>
              <DialogDescription>
                Share this QR code or link with the patient to join the call
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={getJoinUrl()} size={250} />
              </div>
              <div className="w-full space-y-3">
                <Input value={getJoinUrl()} readOnly className="text-xs" />
                <div className="flex gap-2">
                  <Btn kind="ghost" size="sm" onClick={handleCopyLink} full>
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
                  <Btn kind="accent" size="sm" onClick={handleJoinCall} full>
                    <Video className="mr-2 h-4 w-4" /> Join as patient
                  </Btn>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
