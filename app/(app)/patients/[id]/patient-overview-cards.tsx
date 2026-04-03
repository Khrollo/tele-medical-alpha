"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy, Check, Video, ArrowUpRight, Target, Activity, Droplets,
  CalendarDays, ActivitySquare, Pill, Image as ImageIcon, HeartPulse,
  Info, User, History, AlertCircle, Syringe, Users, Speech,
  Stethoscope, FileText, ClipboardList, Folder, BookOpen
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/app/_lib/utils/cn";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
  userRole: string;
}

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

function countSummaryItems(data: unknown) {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (!isRecord(data)) {
    return 0;
  }

  if (Array.isArray(data.entries)) {
    return data.entries.length;
  }

  return Object.values(data).filter((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim() !== "";
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (isRecord(value)) {
      return Object.values(value).some((nestedValue) => {
        if (typeof nestedValue === "string") {
          return nestedValue.trim() !== "";
        }

        if (Array.isArray(nestedValue)) {
          return nestedValue.length > 0;
        }

        return nestedValue !== null && nestedValue !== undefined;
      });
    }

    return true;
  }).length;
}

function normalizeJsonb(data: unknown): unknown[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object") return Object.values(data);
  return [];
}

// Generate some cosmetic graph lines anchored to real values for the new design
const generateEKGData = (baseline: number) => {
    return [
        { val: baseline }, { val: baseline + 5 }, { val: baseline }, { val: baseline - 2 },
        { val: baseline + 25 }, { val: baseline - 20 }, { val: baseline + 5 }, { val: baseline },
        { val: baseline + 3 }, { val: baseline }
    ];
};

const generateBPData = (sys: number, dia: number) => {
    return [
        { sys: sys - 8, dia: dia - 4 },
        { sys: sys + 3, dia: dia + 5 },
        { sys: sys - 5, dia: dia - 2 },
        { sys: sys + 6, dia: dia + 3 },
        { sys: sys, dia: dia }
    ];
};

export function PatientOverviewCards({
  patient,
  stats,
  latestVisit,
  userRole,
}: PatientOverviewCardsProps) {
  const router = useRouter();
  const [showVirtualModal, setShowVirtualModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const isVirtualVisitReady = () => {
    if (!latestVisit) return false;
    const statusLower = latestVisit.status?.toLowerCase() || "";
    if (statusLower === "signed & complete" || statusLower === "completed") return false;
    return latestVisit.appointmentType?.toLowerCase() === "virtual" &&
      latestVisit.clinicianId !== null && latestVisit.patientJoinToken !== null;
  };

  const getJoinUrl = () => {
    if (!latestVisit?.patientJoinToken) return "";
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
    if (joinUrl) router.push(joinUrl);
  };
  const allergies = normalizeAllergies(patient.allergies);
  const medications = normalizeMedications(patient.currentMedications);
  const vitalsArray = normalizeVitals(patient.vitals);
  const familyHistoryCount = countSummaryItems(patient.familyHistory);
  const socialHistoryCount = countSummaryItems(patient.socialHistory);
  const pastMedicalHistoryCount = countSummaryItems(patient.pastMedicalHistory);
  const surgicalHistoryCount = countSummaryItems(patient.surgicalHistory);

  const pastMedicalHistory = normalizeJsonb(patient.pastMedicalHistory) as Array<any>;

  const latestVital = vitalsArray.length > 0
    ? vitalsArray.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })[0] : null;

  const bpRaw = latestVital?.bp || "120/80";
  const sys = parseInt(bpRaw.split("/")[0]) || 120;
  const dia = parseInt(bpRaw.split("/")[1]) || 80;
  const hr = parseInt(latestVital?.hr || "75");
  const tempRaw = parseFloat(latestVital?.temp || "98.6");
  
  // Normalize temp to a pie scale roughly between 95 and 105 for visual gauge
  const tempScale = Math.min(Math.max((tempRaw - 95) / 10 * 100, 0), 100);

  const visitDate = latestVisit
    ? new Date(latestVisit.createdAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }) : null;

  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Top Banner Toggles (Visual) */}
      <div className="flex items-center gap-3">
         <div className="bg-slate-900 text-white rounded-full px-6 py-2.5 text-sm font-semibold border border-slate-800">
            Health indicators
         </div>
         <div className="bg-white text-slate-600 rounded-full px-6 py-2.5 text-sm font-semibold border border-slate-200">
            Diagnosis
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col - Health Overview Widgets */}
        <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* BP / Cells Widget */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 flex flex-col relative h-[240px]">
                  <div className="absolute top-6 right-6 h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <Droplets className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Blood Pressure</h3>
                      <div className="text-secondary-foreground font-bold text-2xl tracking-tight">{bpRaw} <span className="text-xs font-medium text-muted-foreground ml-1">mmHg</span></div>
                    </div>
                  </div>
                  <div className="flex-1 w-full mt-auto -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={generateBPData(sys, dia)}>
                        <defs>
                            <linearGradient id="colorSys" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="sys" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSys)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="dia" stroke="#ef4444" fillOpacity={0} strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

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
                      <div className="text-secondary-foreground font-bold text-2xl tracking-tight">{tempRaw} <span className="text-xs font-medium text-muted-foreground ml-1">°F</span></div>
                    </div>
                  </div>
                  <div className="flex-1 w-full relative mt-[-20px]">
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
                  </div>
                </div>

                {/* Heart Rate EKG Widget */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 flex flex-col relative h-[240px]">
                  <div className="absolute top-6 right-6 h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-3 mb-6 z-10">
                    <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <HeartPulse className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Heart rate</h3>
                      <div className="text-secondary-foreground font-bold text-2xl tracking-tight">{hr} <span className="text-xs font-medium text-muted-foreground ml-1">bpm</span></div>
                    </div>
                  </div>
                  <div className="flex-1 w-full -ml-3 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={generateEKGData(hr)}>
                        <Line type="linear" dataKey="val" stroke="#ef4444" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground text-center mt-2 absolute bottom-5 left-0 right-0">Normal sinus rhythm</div>
                </div>

                {/* Empty Add Placeholder matching design */}
                <div className="bg-transparent rounded-[2rem] p-6 flex flex-col relative h-[240px] border-2 border-dashed border-slate-200 dark:border-slate-700 items-center justify-center cursor-pointer hover:bg-slate-50/50 transition-colors">
                   <div className="h-12 w-12 rounded-full border border-slate-300 flex items-center justify-center text-slate-400">
                      <span className="text-2xl font-light leading-none">+</span>
                   </div>
                </div>

            </div>
        </div>

        {/* Right Col - Appointments Timeline */}
        <div className="lg:col-span-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500">Appointments</h2>
                <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-slate-500" />
                </div>
              </div>
              
              <div className="relative border-l-[3px] border-slate-100 dark:border-slate-800 ml-[11px] space-y-10 pb-4">
                
                {/* Latest Visit Block */}
                {latestVisit ? (
                  <div className="relative pl-8 group">
                    <div className="absolute -left-[10px] top-1.5 h-4 w-4 rounded-full border-[3.5px] border-white dark:border-slate-900 bg-emerald-500 group-hover:scale-125 transition-transform" />
                    <div className="absolute -left-[50px] top-1.5 text-xs font-bold text-slate-600">Now</div>
                    
                    <div className="mb-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{visitDate}</div>
                    <div className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                      {latestVisit.appointmentType?.toLowerCase() === "virtual" ? "Online consultation" : "In-Person Checkup"}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                       <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${latestVisit.clinicianId || 'doctor'}`} alt="avatar" />
                       </div>
                       <div className="text-sm font-medium text-slate-600">Assigned Clinician</div>
                    </div>
                    
                    {isVirtualVisitReady() && (
                      <Button onClick={() => setShowVirtualModal(true)} variant="secondary" className="rounded-full h-8 px-4 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border dark:border-none border-emerald-200">
                         <Video className="h-3.5 w-3.5 mr-2" /> Join Call
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="relative pl-8">
                     <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-[3px] border-white dark:border-slate-900 bg-slate-300" />
                     <div className="text-sm font-semibold text-muted-foreground">No recent appointments</div>
                  </div>
                )}

                {/* Future Empty Block */}
                 <div className="relative pl-8 opacity-60">
                    <div className="absolute -left-[9.5px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white dark:border-slate-900 bg-slate-200" />
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Schedule Next</div>
                    <div className="text-sm font-medium text-slate-500">Unbooked</div>
                 </div>
              </div>
            </div>
        </div>
        <div className="col-span-full mt-4">
            <h2 className="text-2xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white">Disease history</h2>

            <div className="flex overflow-x-auto gap-5 pb-6 thin-scrollbar snap-x">

              {pastMedicalHistory.length > 0 ? pastMedicalHistory.map((pmh, idx) => {
                 // Determine a pill badge and icon randomly or sequentially for visual demonstration of layout
                 const iconPick = idx % 2 === 0 ? <ActivitySquare className="h-8 w-8 text-slate-400 stroke-[1.5]" /> : <ImageIcon className="h-8 w-8 text-slate-400 stroke-[1.5]" />;
                 const hasMed = medications.length > idx;

                 return (
                  <div key={idx} className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 border border-slate-100 dark:border-slate-800 min-w-[340px] flex gap-5 snap-start shrink-0 hover:-translate-y-1 transition-transform relative">

                    {/* Visual Preview Left Block */}
                    <div className="w-[100px] h-[120px] bg-slate-50 dark:bg-slate-800 rounded-[1.5rem] flex flex-col items-center justify-center shrink-0 overflow-hidden relative border border-slate-100">
                       {iconPick}
                       <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-white border border-slate-100 flex items-center justify-center">
                          <Activity className="h-3 w-3 text-slate-600" />
                       </div>
                    </div>

                    {/* Details Column */}
                    <div className="flex flex-col flex-1 py-1">
                      <div className="mb-2">
                        <span className="font-bold text-[15px] leading-tight line-clamp-2 text-slate-800 dark:text-slate-100">
                           {pmh.condition || 'Documented Condition'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-4 text-xs font-medium text-slate-500">
                        <div className="h-5 w-5 rounded-full overflow-hidden shrink-0 bg-slate-200">
                           <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${pmh.condition || 'doc'}`} alt="doc" />
                        </div>
                        <span>Attending Specialist</span>
                      </div>
                      
                      <div className="mt-auto">
                        <div className="text-xs font-bold text-slate-800 mb-2">Medications</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                           {hasMed ? (
                             <>
                               <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 rounded-full pl-1.5 pr-3 py-1 flex items-center gap-2">
                                  <div className="h-5 w-5 rounded-full bg-white border border-slate-50 flex items-center justify-center">
                                    <Pill className="h-3.5 w-3.5 text-blue-500" />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-600">{medications[idx].brandName || medications[idx].name || "Med"}</span>
                               </div>
                               {medications.length > idx + 1 && (
                                  <div className="h-7 w-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                                     +{medications.length - (idx + 1)}
                                  </div>
                               )}
                             </>
                           ) : (
                             <span className="text-xs font-medium text-slate-400">No active prescriptions</span>
                           )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }) : (
                 <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 text-slate-500 text-sm font-medium w-full flex items-center justify-center">
                    No documented disease history.
                 </div>
              )}
            </div>
        </div>

      </div>

      {/* Virtual Visit Modal for Nurses remains functionally identical */}
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
                      <Button onClick={handleCopyLink} variant="outline" className="flex-1" size="sm">
                         {copied ? <><Check className="h-4 w-4 mr-2" /> Copied</> : <><Copy className="h-4 w-4 mr-2" /> Copy Link</>}
                      </Button>
                      <Button onClick={handleJoinCall} variant="default" className="flex-1" size="sm">
                         <Video className="h-4 w-4 mr-2" /> Join as Patient
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
