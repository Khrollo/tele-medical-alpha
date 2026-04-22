"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import {
    Video,
    Copy,
    Check,
    Pill as PillIcon,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Plus,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/app/_lib/utils/format-date";
import { formatVisitStatusLabel } from "@/app/_lib/utils/visit-status-label";
import {
  deriveWorkflowChips,
  type WorkflowFlags,
} from "@/app/_lib/utils/patient-workflow-chips";
import { Avatar, Btn, Pill, type PillTone } from "@/components/ui/clearing";

interface VisitInfo {
    id: string;
    status: string | null;
    notesStatus: string | null;
    appointmentType: string | null;
    clinicianId: string | null;
    patientJoinToken: string | null;
    twilioRoomName: string | null;
    createdAt: Date;
}

interface Patient {
    id: string;
    fullName: string;
    dob: string | Date | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    clinicianName: string | null;
    clinicianEmail: string | null;
    allergiesCount: number;
    medicationsCount: number;
    createdAt: Date | null;
    visit: VisitInfo | null;
    workflow?: WorkflowFlags | null;
}

interface PatientsListProps {
    patients: Patient[];
    allPatients?: Patient[];
    userRole: string;
}

function statusPill(status: string | null): { label: string; tone: PillTone } | null {
    if (!status) return null;
    const s = status.trim().toLowerCase().replace(/[_-]/g, " ");
    if (s === "in progress" || s === "draft") return { label: "In progress", tone: "info" };
    if (
        s === "signed & complete" ||
        s === "signed and complete" ||
        s === "completed"
    )
        return { label: "Signed", tone: "ok" };
    if (s === "waiting") return { label: "Waiting", tone: "warn" };
    return { label: formatVisitStatusLabel(status), tone: "neutral" };
}

function typePill(type: string | null): { label: string; tone: PillTone } | null {
    if (!type) return null;
    const t = type.trim().toLowerCase().replace(/[_-]/g, " ");
    if (t === "virtual") return { label: "Virtual", tone: "accent" };
    if (t === "in person") return { label: "In-person", tone: "neutral" };
    const normalized = t
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    return { label: normalized, tone: "neutral" };
}

export function PatientsList({ patients, allPatients, userRole }: PatientsListProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [showVirtualModal, setShowVirtualModal] = useState<{
        patientId: string;
        visitId: string;
        joinUrl: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const initialSearchQuery = searchParams.get("search") || "";
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [currentPage, setCurrentPage] = useState(1);

    const PATIENTS_PER_PAGE = 9;

    // Initialize search input from URL param on mount (run once).
    React.useEffect(() => {
        const topBarSearch = document.getElementById("patients-search") as HTMLInputElement;
        if (topBarSearch && initialSearchQuery) {
            topBarSearch.value = initialSearchQuery;
            setSearchQuery(initialSearchQuery);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only URL → local state sync
    }, []);

    // Sync search with top bar search input
    React.useEffect(() => {
        const topBarSearch = document.getElementById("patients-search") as HTMLInputElement;
        if (topBarSearch) {
            const handleInput = (e: Event) => {
                const target = e.target as HTMLInputElement;
                setSearchQuery(target.value);
            };
            topBarSearch.addEventListener("input", handleInput);
            if (topBarSearch.value !== searchQuery) {
                topBarSearch.value = searchQuery;
            }
            return () => {
                topBarSearch.removeEventListener("input", handleInput);
            };
        }
    }, [searchQuery]);

    React.useEffect(() => {
        const topBarSearch = document.getElementById("patients-search") as HTMLInputElement;
        if (topBarSearch && topBarSearch.value !== searchQuery) {
            topBarSearch.value = searchQuery;
        }
    }, [searchQuery]);

    const calculateAge = (dob: string | Date | null) => {
        if (!dob) return null;
        try {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
            const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
            if (
                monthDiff < 0 ||
                (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())
            ) {
                age--;
            }
            return age;
        } catch {
            return null;
        }
    };

    const canContinueVisit = (visit: VisitInfo | null) => {
        if (!visit) return false;
        const normalizedStatus = (visit.status ?? "").trim().toLowerCase().replace(/[_-]/g, " ");
        const normalizedNoteStatus = (visit.notesStatus ?? "")
            .trim()
            .toLowerCase()
            .replace(/[_-]/g, " ");
        return (
            normalizedStatus === "in progress" ||
            normalizedStatus === "waiting" ||
            normalizedStatus === "draft" ||
            normalizedNoteStatus === "in progress" ||
            normalizedNoteStatus === "draft"
        );
    };

    const isVirtualVisitReady = (visit: VisitInfo | null) => {
        if (!visit) return false;
        const statusLower = visit.status?.toLowerCase() || "";
        if (
            statusLower === "signed & complete" ||
            statusLower === "signed_and_complete" ||
            statusLower === "completed"
        ) {
            return false;
        }
        return (
            visit.appointmentType?.toLowerCase() === "virtual" &&
            visit.clinicianId !== null &&
            visit.patientJoinToken !== null
        );
    };

    const getJoinUrl = (visit: VisitInfo | null) => {
        if (!visit?.patientJoinToken) return "";
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        return `${baseUrl}/join/${visit.patientJoinToken}`;
    };

    const handleCopyLink = async (joinUrl: string) => {
        await navigator.clipboard.writeText(joinUrl);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJoinCall = (joinUrl: string) => {
        router.push(joinUrl);
    };

    const scopedPatients = useMemo(() => {
        const query = searchQuery.trim();
        if (userRole === "nurse" && query.length > 0) {
            return allPatients ?? patients;
        }
        return patients;
    }, [allPatients, patients, searchQuery, userRole]);

    const filteredPatients = useMemo(() => {
        if (!searchQuery.trim()) return scopedPatients;
        const query = searchQuery.toLowerCase();
        return scopedPatients.filter((patient) => {
            const fullName = patient.fullName.toLowerCase();
            const phone = patient.phone?.toLowerCase() || "";
            const email = patient.email?.toLowerCase() || "";
            const clinicianName = patient.clinicianName?.toLowerCase() || "";
            const clinicianEmail = patient.clinicianEmail?.toLowerCase() || "";
            return (
                fullName.includes(query) ||
                phone.includes(query) ||
                email.includes(query) ||
                clinicianName.includes(query) ||
                clinicianEmail.includes(query)
            );
        });
    }, [scopedPatients, searchQuery]);

    const totalPages = Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE);
    const startIndex = (currentPage - 1) * PATIENTS_PER_PAGE;
    const endIndex = startIndex + PATIENTS_PER_PAGE;
    const paginatedPatients = filteredPatients.slice(startIndex, endIndex);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div
                        className="text-[10.5px] uppercase"
                        style={{
                            color: "var(--ink-3)",
                            letterSpacing: "0.12em",
                            fontWeight: 600,
                        }}
                    >
                        {userRole === "doctor" ? "Clinic" : "Patients"}
                    </div>
                    <h1
                        className="serif"
                        style={{
                            margin: "4px 0 0",
                            fontSize: 28,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.15,
                            color: "var(--ink)",
                        }}
                    >
                        {userRole === "doctor"
                            ? "Assigned & active patients"
                            : "Active & recent patients"}
                        {filteredPatients.length > 0 && (
                            <span
                                className="mono"
                                style={{
                                    marginLeft: 10,
                                    fontSize: 15,
                                    color: "var(--ink-3)",
                                    letterSpacing: 0,
                                }}
                            >
                                {filteredPatients.length}
                            </span>
                        )}
                    </h1>
                </div>
                <Link href="/patients/new">
                    <Btn kind="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                        Add patient
                    </Btn>
                </Link>
            </div>

            {filteredPatients.length > 0 && searchQuery && (
                <div
                    className="w-fit rounded-full px-3 py-1 text-[11.5px]"
                    style={{
                        background: "var(--paper-3)",
                        color: "var(--ink-2)",
                        border: "1px solid var(--line)",
                    }}
                >
                    Results for &quot;{searchQuery}&quot;
                </div>
            )}

            {/* Cards */}
            {paginatedPatients.length === 0 ? (
                <div
                    className="rounded-[14px] py-16 text-center"
                    style={{
                        border: "1px dashed var(--line)",
                        color: "var(--ink-3)",
                        fontSize: 13,
                    }}
                >
                    {searchQuery
                        ? `No patients found matching "${searchQuery}"`
                        : "Your patient list is empty."}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {paginatedPatients.map((patient) => {
                            const virtualReady = isVirtualVisitReady(patient.visit);
                            const joinUrl = getJoinUrl(patient.visit);
                            const age = calculateAge(patient.dob);
                            const continueVisitHref = patient.visit
                                ? `/patients/${patient.id}/new-visit?visitId=${patient.visit.id}`
                                : null;
                            const showContinueVisit = canContinueVisit(patient.visit);
                            const sPill = statusPill(patient.visit?.status ?? null);
                            const tPill = typePill(patient.visit?.appointmentType ?? null);
                            const workflowChips = deriveWorkflowChips(patient.workflow ?? null);

                            return (
                                <Link
                                    key={patient.id}
                                    href={`/patients/${patient.id}`}
                                    className="group block"
                                >
                                    <div
                                        className="flex h-full flex-col overflow-hidden rounded-[14px] transition-all group-hover:-translate-y-0.5"
                                        style={{
                                            background: "var(--card)",
                                            border: "1px solid var(--line)",
                                            boxShadow: "0 1px 0 oklch(0 0 0 / 0.02)",
                                        }}
                                    >
                                        {/* Header — mirrors the Vitals card header:
                                            avatar (icon) · serif name · right meta ·
                                            ghost action · bottom divider */}
                                        <div
                                            className="flex flex-wrap items-center gap-2.5 px-5 py-4"
                                            style={{ borderBottom: "1px solid var(--line)" }}
                                        >
                                            <Avatar name={patient.fullName} src={patient.avatarUrl} size={32} />
                                            <div
                                                className="serif min-w-0 truncate"
                                                style={{
                                                    fontSize: 18,
                                                    letterSpacing: "-0.01em",
                                                    color: "var(--ink)",
                                                }}
                                            >
                                                {patient.fullName}
                                            </div>
                                            <div className="flex-1" />
                                            <div
                                                className="mono text-[11.5px]"
                                                style={{ color: "var(--ink-3)" }}
                                            >
                                                {age !== null && `${age} yrs`}
                                                {age !== null && patient.dob ? " · " : ""}
                                                {patient.dob ? formatDate(patient.dob) : ""}
                                            </div>
                                        </div>

                                        <div className="flex flex-1 flex-col gap-3 px-5 py-3.5">
                                            {/* Status + appointment + clinician on one line */}
                                            {(sPill || tPill || patient.clinicianName) && (
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                    {sPill && (
                                                        <Pill tone={sPill.tone} dot>
                                                            {sPill.label}
                                                        </Pill>
                                                    )}
                                                    {tPill && <Pill tone={tPill.tone}>{tPill.label}</Pill>}
                                                    {patient.clinicianName && (
                                                        <span
                                                            className="truncate text-[12px]"
                                                            style={{ color: "var(--ink-2)" }}
                                                        >
                                                            {patient.clinicianName}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Workflow status chips — vitals, labs, imaging, check-in */}
                                            {workflowChips.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                                                    {workflowChips.map((chip) => (
                                                        <Pill key={chip.key} tone={chip.tone} dot={chip.dot}>
                                                            {chip.label}
                                                        </Pill>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Inline clinical signals: meds · allergies · last seen */}
                                            <div
                                                className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px]"
                                                style={{ color: "var(--ink-2)" }}
                                            >
                                                <span className="inline-flex items-center gap-1.5">
                                                    <PillIcon
                                                        className="h-3.5 w-3.5"
                                                        style={{ color: "var(--brand-ink)" }}
                                                    />
                                                    <span>
                                                        {patient.medicationsCount} med{patient.medicationsCount === 1 ? "" : "s"}
                                                    </span>
                                                </span>
                                                <span className="inline-flex items-center gap-1.5">
                                                    <AlertCircle
                                                        className="h-3.5 w-3.5"
                                                        style={{ color: patient.allergiesCount > 0 ? "var(--critical)" : "var(--ink-3)" }}
                                                    />
                                                    <span>
                                                        {patient.allergiesCount} allerg{patient.allergiesCount === 1 ? "y" : "ies"}
                                                    </span>
                                                </span>
                                                <span className="mono" style={{ color: "var(--ink-3)" }}>
                                                    {patient.visit
                                                        ? `Last seen ${formatDate(patient.visit.createdAt)}`
                                                        : "No visits"}
                                                </span>
                                            </div>

                                            {/* Footer — actions only */}
                                            <div className="mt-auto flex items-center justify-end gap-1.5 pt-1">
                                                    <Btn
                                                        kind="ghost"
                                                        size="sm"
                                                        iconRight={<ChevronRight className="h-3.5 w-3.5" />}
                                                    >
                                                        Open
                                                    </Btn>
                                                    {showContinueVisit && continueVisitHref && (
                                                        <Btn
                                                            kind="primary"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                router.push(continueVisitHref);
                                                            }}
                                                        >
                                                            Continue visit
                                                        </Btn>
                                                    )}
                                                    {virtualReady && (
                                                        <Btn
                                                            kind="soft"
                                                            size="sm"
                                                            icon={<Video className="h-3.5 w-3.5" />}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowVirtualModal({
                                                                    patientId: patient.id,
                                                                    visitId: patient.visit!.id,
                                                                    joinUrl,
                                                                });
                                                            }}
                                                        >
                                                            Call
                                                        </Btn>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div
                            className="mt-4 flex items-center justify-between pt-4"
                            style={{ borderTop: "1px solid var(--line)" }}
                        >
                            <div
                                className="text-[10.5px] uppercase"
                                style={{
                                    color: "var(--ink-3)",
                                    letterSpacing: "0.12em",
                                    fontWeight: 600,
                                }}
                            >
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <Btn
                                    kind="ghost"
                                    size="sm"
                                    icon={<ChevronLeft className="h-3.5 w-3.5" />}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    Prev
                                </Btn>
                                <span
                                    className="serif"
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 30,
                                        height: 30,
                                        borderRadius: 999,
                                        background: "var(--ink)",
                                        color: "var(--paper)",
                                        fontSize: 13,
                                        letterSpacing: "-0.01em",
                                    }}
                                >
                                    {currentPage}
                                </span>
                                <Btn
                                    kind="ghost"
                                    size="sm"
                                    iconRight={<ChevronRight className="h-3.5 w-3.5" />}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Btn>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Virtual Visit Modal — kept on shadcn Dialog since that’s what the rest of the app uses */}
            {showVirtualModal && (
                <Dialog
                    open={!!showVirtualModal}
                    onOpenChange={(open) => !open && setShowVirtualModal(null)}
                >
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Virtual visit — patient join link</DialogTitle>
                            <DialogDescription>
                                Share this QR code or link with the patient to join the call.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div
                                className="rounded-lg p-4"
                                style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
                            >
                                <QRCodeSVG value={showVirtualModal.joinUrl} size={250} />
                            </div>
                            <div className="w-full space-y-3">
                                <Input value={showVirtualModal.joinUrl} readOnly className="text-xs" />
                                <div className="flex gap-2">
                                    <Btn
                                        kind="ghost"
                                        size="sm"
                                        full
                                        icon={
                                            copied ? (
                                                <Check className="h-3.5 w-3.5" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5" />
                                            )
                                        }
                                        onClick={() => handleCopyLink(showVirtualModal.joinUrl)}
                                    >
                                        {copied ? "Copied" : "Copy link"}
                                    </Btn>
                                    <Btn
                                        kind="primary"
                                        size="sm"
                                        full
                                        icon={<Video className="h-3.5 w-3.5" />}
                                        onClick={() => handleJoinCall(showVirtualModal.joinUrl)}
                                    >
                                        Join as patient
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
