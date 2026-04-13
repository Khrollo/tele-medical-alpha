"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
<<<<<<< Updated upstream
import { Calendar, Heart, Pill, History, AlertTriangle, FileText, Video, Copy, Check } from "lucide-react";
=======
import {
  Copy, Check, Video, ArrowUpRight, Target, Activity, Droplets,
  ActivitySquare, Pill, Image as ImageIcon, HeartPulse,
  History, AlertCircle
} from "lucide-react";
>>>>>>> Stashed changes
import { QRCodeSVG } from "qrcode.react";
import { formatDate } from "@/app/_lib/utils/format-date";
import { toast } from "sonner";
<<<<<<< Updated upstream
=======
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis, Tooltip } from "recharts";
>>>>>>> Stashed changes

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
  userRole: string;
}

<<<<<<< Updated upstream
/**
 * Normalize JSONB data to array format
 */
=======
type OverviewAllergy = {
  name?: string;
  type?: string;
};

type OverviewMedication = {
  id?: string;
  brandName?: string;
  genericName?: string;
  name?: string;
  medication?: string;
  dosage?: string;
  frequency?: string;
  status?: string;
};

type OverviewHistoryItem = {
  condition?: string;
  status?: string;
  diagnosedDate?: string;
};

/**
 * Normalize JSONB data to array format
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (!isRecord(data)) {
    return [];
  }

  if (Array.isArray(data.entries)) {
    return data.entries.filter(isRecord);
  }

  return Object.values(data).filter(isRecord);
}

function normalizeAllergies(data: unknown): OverviewAllergy[] {
  if (Array.isArray(data)) {
    if (data.every(isRecord)) {
      return data as OverviewAllergy[];
    }

    return data
      .filter(isNonEmptyString)
      .map<OverviewAllergy>((entry) => ({ name: entry.trim() }));
  }

  return normalizeList(data) as OverviewAllergy[];
}

function normalizeMedications(data: unknown): OverviewMedication[] {
  if (Array.isArray(data)) {
    if (data.every(isRecord)) {
      return data as OverviewMedication[];
    }

    return data
      .filter(isNonEmptyString)
      .map<OverviewMedication>((entry) => ({ name: entry.trim() }));
  }

  return normalizeList(data) as OverviewMedication[];
}

function normalizeVitals(data: unknown) {
  if (Array.isArray(data)) {
    return data.filter(isRecord) as Array<{
      id?: string;
      date?: string;
      bp?: string;
      hr?: string;
      temp?: string;
      weight?: string;
      height?: string;
      bmi?: string;
      spo2?: string;
      rr?: string;
    }>;
  }

  if (!isRecord(data)) {
    return [];
  }

  if (Array.isArray(data.entries)) {
    return data.entries.filter(isRecord) as Array<{
      id?: string;
      date?: string;
      bp?: string;
      hr?: string;
      temp?: string;
      weight?: string;
      height?: string;
      bmi?: string;
      spo2?: string;
      rr?: string;
    }>;
  }

  if (
    "bp" in data ||
    "hr" in data ||
    "temp" in data ||
    "weight" in data ||
    "height" in data ||
    "bmi" in data ||
    "spo2" in data ||
    "rr" in data
  ) {
    return [data] as Array<{
      id?: string;
      date?: string;
      bp?: string;
      hr?: string;
      temp?: string;
      weight?: string;
      height?: string;
      bmi?: string;
      spo2?: string;
      rr?: string;
    }>;
  }

  return Object.values(data).filter(
    (value) =>
      isRecord(value) &&
      ("bp" in value || "hr" in value || "temp" in value || "weight" in value)
  ) as Array<{
    id?: string;
    date?: string;
    bp?: string;
    hr?: string;
    temp?: string;
    weight?: string;
    height?: string;
    bmi?: string;
    spo2?: string;
    rr?: string;
  }>;
}

>>>>>>> Stashed changes
function normalizeJsonb(data: unknown): unknown[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") return Object.values(data);
  return [];
}

<<<<<<< Updated upstream
/**
 * Calculate visit note progress based on status
 */
function calculateVisitProgress(notesStatus: string | null): number {
  if (!notesStatus) return 0;
  if (notesStatus === "draft") return 25;
  if (notesStatus === "in-progress") return 50;
  if (notesStatus === "review") return 75;
  if (notesStatus === "finalized") return 100;
  return 0;
}
=======
const generateBPData = (sys: number, dia: number) => {
    return [
        { sys: sys - 8, dia: dia - 4 },
        { sys: sys + 3, dia: dia + 5 },
        { sys: sys - 5, dia: dia - 2 },
        { sys: sys + 6, dia: dia + 3 },
        { sys: sys, dia: dia }
    ];
};
>>>>>>> Stashed changes

export function PatientOverviewCards({
  patient,
  latestVisit,
<<<<<<< Updated upstream
  userRole,
=======
  recentVisits,
>>>>>>> Stashed changes
}: PatientOverviewCardsProps) {
  const router = useRouter();
  const [showVirtualModal, setShowVirtualModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const isVirtualVisitReady = () => {
    if (!latestVisit) return false;

    // Don't show link for signed and complete visits
    const statusLower = latestVisit.status?.toLowerCase() || "";
    if (statusLower === "signed & complete" ||
      statusLower === "signed_and_complete" ||
      statusLower === "completed") {
      return false;
    }

    return latestVisit.appointmentType?.toLowerCase() === "virtual" &&
      latestVisit.clinicianId !== null &&
      latestVisit.patientJoinToken !== null;
  };

  const getJoinUrl = () => {
    if (!latestVisit?.patientJoinToken) return "";
    // Use forwarded port URL for testing on phone
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/join/${latestVisit.patientJoinToken}`;
  };

  const handleCopyLink = async () => {
    const joinUrl = getJoinUrl();
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinCall = () => {
    const joinUrl = getJoinUrl();
    if (joinUrl) {
      router.push(joinUrl);
    }
  };
<<<<<<< Updated upstream
  const allergies = normalizeJsonb(patient.allergies) as Array<{ name?: string; type?: string }>;
  const medications = normalizeJsonb(patient.currentMedications) as Array<{
    id?: string;
    brandName?: string;
    genericName?: string;
    name?: string; // Legacy field
    medication?: string; // Legacy field
    dosage?: string;
    frequency?: string;
    status?: string;
  }>;
  // Vitals is an array of VitalEntry objects, get the most recent one
  const vitalsArray = normalizeJsonb(patient.vitals) as Array<{
    id?: string;
    date?: string;
    bp?: string;
    hr?: string;
    temp?: string;
    weight?: string;
    height?: string;
    bmi?: string;
    spo2?: string;
    rr?: string;
  }>;
  const familyHistory = normalizeJsonb(patient.familyHistory);
  const socialHistory = normalizeJsonb(patient.socialHistory);
  const pastMedicalHistory = normalizeJsonb(patient.pastMedicalHistory);
=======
  const allergies = normalizeAllergies(patient.allergies);
  const medications = normalizeMedications(patient.currentMedications);
  const vitalsArray = normalizeVitals(patient.vitals);

  const pastMedicalHistory = normalizeJsonb(patient.pastMedicalHistory) as OverviewHistoryItem[];
>>>>>>> Stashed changes

  // Get the most recent vital entry (sorted by date, most recent first)
  const latestVital = vitalsArray.length > 0
    ? vitalsArray.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })[0]
    : null;

<<<<<<< Updated upstream
  // Extract vitals from the most recent entry
  const bp = latestVital?.bp;
  const hr = latestVital?.hr;
  const temp = latestVital?.temp;
  const weight = latestVital?.weight;
=======
  const vitalsTrendData = [...vitalsArray]
    .filter((entry) => entry.date)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    })
    .map((entry) => {
      const hrValue = entry.hr ? Number.parseFloat(entry.hr) : null;
      const weightValue = entry.weight ? Number.parseFloat(entry.weight) : null;
      const bpValue = entry.bp ?? "";
      const systolicValue = bpValue.includes("/")
        ? Number.parseFloat(bpValue.split("/")[0])
        : null;

      return {
        dateLabel: entry.date
          ? new Date(entry.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "",
        hr: Number.isFinite(hrValue as number) ? hrValue : null,
        weight: Number.isFinite(weightValue as number) ? weightValue : null,
        systolic: Number.isFinite(systolicValue as number) ? systolicValue : null,
      };
    })
    .filter((entry) => entry.hr !== null || entry.weight !== null || entry.systolic !== null);

  const bpRaw = latestVital?.bp || null;
  const sys = bpRaw ? parseInt(bpRaw.split("/")[0]) || null : null;
  const dia = bpRaw ? parseInt(bpRaw.split("/")[1]) || null : null;
  const hr = latestVital?.hr ? parseInt(latestVital.hr) || null : null;
  const tempRaw = latestVital?.temp ? parseFloat(latestVital.temp) || null : null;
>>>>>>> Stashed changes

  // Calculate risk flags
  const hasHighBP = bp && (bp.includes("/") ? parseInt(bp.split("/")[0]) > 140 : false);
  const hasFever = temp && parseFloat(temp) > 100.4;
  const hasRiskFlags = hasHighBP || hasFever;

<<<<<<< Updated upstream
  // Visit progress
  const visitProgress = latestVisit ? calculateVisitProgress(latestVisit.notesStatus) : 0;
  const visitDate = latestVisit ? formatDate(latestVisit.createdAt) : null;

=======
>>>>>>> Stashed changes
  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {/* Last Visit Card */}
      <Link href={`/patients/${patient.id}/visit-history`}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Last Visit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestVisit ? (
              <>
                <div>
                  <p className="text-sm font-medium text-foreground">{visitDate}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {latestVisit.chiefComplaint && latestVisit.chiefComplaint.trim()
                      ? latestVisit.chiefComplaint
                      : "No chief complaint recorded"}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Visit note progress</span>
                    <span className="font-medium">{visitProgress}%</span>
                  </div>
                  <Progress value={visitProgress} />
                </div>

<<<<<<< Updated upstream
                {/* Visit Status - Show for nurses */}
                {userRole === "nurse" && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex flex-wrap gap-2">
                      {latestVisit.status && (
                        <Badge variant={latestVisit.status === "In Progress" ? "default" : "outline"}>
                          {latestVisit.status}
                        </Badge>
=======
                {/* Temp Gauge Visual Widget */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 flex flex-col relative h-[240px]">
                  <div className="absolute top-6 right-6 h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-3 mb-2 z-10">
                    <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Vital Temp</h3>
                      <div className="text-secondary-foreground font-bold text-2xl tracking-tight">
                        {tempRaw !== null ? <>{tempRaw} <span className="text-xs font-medium text-muted-foreground ml-1">°F</span></> : <span className="text-muted-foreground text-base">No data</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full relative mt-[-20px]">
                    {tempRaw !== null ? (
                    <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[{ value: tempScale }, { value: 100 - tempScale }]}
                          cx="50%" cy="100%"
                          startAngle={180} endAngle={0}
                          innerRadius="75%" outerRadius="95%"
                          dataKey="value"
                          stroke="none"
                          cornerRadius={8}
                        >
                          <Cell fill={tempRaw > 100 ? "#ef4444" : "#10b981"} />
                          <Cell fill="#f1f5f9" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-semibold text-muted-foreground">Thermometer</div>
                    </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Record vitals to see gauge</div>
                    )}
                  </div>
                </div>

                {/* Patient-Specific Vitals Trend Widget */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 flex flex-col relative h-[240px]">
                  <div className="absolute top-6 right-6 h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-3 mb-6 z-10">
                    <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <HeartPulse className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Vitals Over Time</h3>
                      <div className="text-secondary-foreground font-bold text-2xl tracking-tight">
                        {hr !== null ? (
                          <>
                            {hr} <span className="text-xs font-medium text-muted-foreground ml-1">latest bpm</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-base">No data</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 w-full -ml-3 relative">
                    {vitalsTrendData.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsTrendData}>
                          <XAxis dataKey="dateLabel" hide />
                          <YAxis hide />
                          <Tooltip />
                          <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="systolic" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Record multiple vitals to see trend</div>
                    )}
                  </div>
                </div>

                {/* Allergies Summary Widget */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 flex flex-col relative h-[240px]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Allergies</h3>
                      <div className="text-secondary-foreground font-bold text-2xl tracking-tight">
                        {allergies.length > 0 ? <>{allergies.length} <span className="text-xs font-medium text-muted-foreground ml-1">recorded</span></> : <span className="text-muted-foreground text-base">None recorded</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {allergies.slice(0, 5).map((a, i) => (
                          <span key={i} className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 text-xs font-semibold">
                            {a.name || 'Unknown'}
                          </span>
                        ))}
                        {allergies.length > 5 && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-full px-3 py-1 text-xs font-bold">+{allergies.length - 5} more</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No known allergies</div>
                    )}
                  </div>
                </div>

            </div>
        </div>

        {/* Right Col - Recent Visits Timeline */}
        <div className="lg:col-span-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500">Recent Visits</h2>
                <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <History className="h-5 w-5 text-slate-500" />
                </div>
              </div>

              <div className="relative border-l-[3px] border-slate-100 dark:border-slate-800 ml-[11px] space-y-8 pb-4">

                {recentVisits.length > 0 ? recentVisits.map((visit, idx) => {
                  const vDate = new Date(visit.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                  });
                  const statusColor = visit.status?.toLowerCase() === "signed & complete" || visit.status?.toLowerCase() === "completed"
                    ? "bg-emerald-500"
                    : visit.status?.toLowerCase() === "in progress"
                    ? "bg-amber-500"
                    : "bg-slate-300";

                  return (
                    <Link key={visit.id} href={`/patients/${patient.id}/visit-history`} className="relative pl-8 group block">
                      <div className={`absolute -left-[10px] top-1.5 h-4 w-4 rounded-full border-[3.5px] border-white dark:border-slate-900 ${statusColor} group-hover:scale-125 transition-transform`} />
                      {idx === 0 && (
                        <div className="mb-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Latest
                        </div>
                      )}

                      <div className="mb-1 text-sm font-semibold text-slate-500">{vDate}</div>
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize">
                        {visit.appointmentType || "Visit"}
                      </div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">{visit.status || "Unknown status"}</div>

                      {idx === 0 && isVirtualVisitReady() && (
                        <Button onClick={(e) => { e.preventDefault(); setShowVirtualModal(true); }} variant="secondary" className="rounded-full h-8 px-4 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border dark:border-none border-emerald-200 mt-2">
                           <Video className="h-3.5 w-3.5 mr-2" /> Join Call
                        </Button>
>>>>>>> Stashed changes
                      )}
                      {latestVisit.appointmentType && (
                        <Badge
                          variant="default"
                          className={
                            latestVisit.appointmentType.toLowerCase() === "virtual"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500"
                          }
                        >
                          {latestVisit.appointmentType}
                        </Badge>
                      )}
                    </div>

                    {/* Virtual Visit Join Button for Nurses */}
                    {isVirtualVisitReady() && (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          setShowVirtualModal(true);
                        }}
                        variant="outline"
                        className="w-full"
                        size="sm"
                      >
                        <Video className="h-4 w-4 mr-2" />
                        View Virtual Visit
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No visits recorded</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Vitals Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
            Vitals Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">BP</p>
              <p className="text-sm font-medium">{bp || "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">HR</p>
              <p className="text-sm font-medium">{hr ? `${hr} bpm` : "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Temp</p>
              <p className="text-sm font-medium">{temp ? `${temp}°F` : "--"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Weight</p>
              <p className="text-sm font-medium">{weight ? `${weight} lbs` : "--"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allergies Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Allergies
            </span>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500 dark:border-orange-400">
              {allergies.length} active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allergies.length > 0 ? (
            <ul className="space-y-2">
              {allergies.slice(0, 3).map((allergy, index) => (
                <li key={index} className="text-sm text-foreground">
                  {allergy.name || allergy.type || "Unknown allergy"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No known allergies</p>
          )}
        </CardContent>
      </Card>

      {/* Current Medications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Pill className="h-5 w-5 text-muted-foreground" />
            Current Medications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {medications.length > 0 ? (
            <ul className="space-y-2">
              {medications.slice(0, 3).map((med, index) => {
                // Get medication display name - prioritize brandName/genericName, fallback to legacy fields
                let medName = "Unknown medication";
                if (med.brandName && med.genericName) {
                  medName = `${med.brandName} (${med.genericName})`;
                } else if (med.brandName) {
                  medName = med.brandName;
                } else if (med.genericName) {
                  medName = med.genericName;
                } else if (med.name) {
                  medName = med.name; // Legacy field
                } else if (med.medication) {
                  medName = med.medication; // Legacy field
                }

                return (
                  <li key={med.id || index} className="text-sm text-foreground">
                    {medName}
                    {med.dosage && (
                      <span className="text-muted-foreground ml-2">({med.dosage})</span>
                    )}
                    {med.frequency && !med.dosage && (
                      <span className="text-muted-foreground ml-2">({med.frequency})</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No medications recorded</p>
          )}
        </CardContent>
      </Card>

      {/* History Highlights Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            History Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Family History</p>
              <p className="text-lg font-semibold">{familyHistory.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Social History</p>
              <p className="text-lg font-semibold">{socialHistory.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Surgical History</p>
              <p className="text-lg font-semibold">0</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Past Medical History</p>
              <p className="text-lg font-semibold">{pastMedicalHistory.length}</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground mb-2">Risk Flags</p>
            {hasRiskFlags ? (
              <div className="flex flex-wrap gap-2">
                {hasHighBP && (
                  <Badge variant="destructive">High BP</Badge>
                )}
                {hasFever && (
                  <Badge variant="destructive">Fever</Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No flags</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders & Documents Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Orders & Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Orders</p>
              <p className="text-lg font-semibold">0</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Documents</p>
              <p className="text-lg font-semibold">0</p>
            </div>
          </div>
          <Separator />
        </CardContent>
      </Card>

      {/* Virtual Visit Modal for Nurses */}
      {showVirtualModal && isVirtualVisitReady() && (
        <Dialog open={showVirtualModal} onOpenChange={setShowVirtualModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Virtual Visit - Patient Join Link</DialogTitle>
              <DialogDescription>
                Share this QR code or link with the patient to join the call
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={getJoinUrl()} size={250} />
              </div>
              <div className="w-full space-y-3">
                <Input value={getJoinUrl()} readOnly className="text-xs" />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="flex-1"
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
                  <Button
                    onClick={handleJoinCall}
                    variant="default"
                    className="flex-1"
                    size="sm"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Join as Patient
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

