"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AudioWaveform,
  BookOpen,
  ClipboardList,
  FileText,
  Folder,
  History,
  Home,
  Mic,
  Phone,
  Pill,
  Send,
  Speech,
  Stethoscope,
  Syringe,
  User,
  Users,
} from "lucide-react";

import { SideNav } from "@/components/side-nav";
import { TopBar } from "@/components/top-bar";
import { Avatar, Btn, Divider, Pill as StatusPill } from "@/components/ui/clearing";
import { cn } from "@/app/_lib/utils/cn";

type PatientSummary = {
    id: string;
    fullName: string;
    dob: string | null;
    avatarUrl: string | null;
    allergies: unknown;
};

interface PatientChartShellProps {
    children: React.ReactNode;
    patientId: string;
    patientName: string;
    patient?: PatientSummary;
    userRole: string;
    userName?: string | null;
}

type NavItem = { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; href: string };

function countAllergies(data: unknown): number {
    if (!data) return 0;
    if (Array.isArray(data)) return data.filter(Boolean).length;
    if (typeof data === "object") return Object.values(data as Record<string, unknown>).filter(Boolean).length;
    return 0;
}

function formatAllergiesSummary(data: unknown): string[] {
    const list: string[] = [];
    const push = (v: unknown) => {
        if (typeof v === "string") list.push(v);
        else if (v && typeof v === "object" && "name" in (v as Record<string, unknown>)) {
            const n = (v as Record<string, unknown>).name;
            if (typeof n === "string") list.push(n);
        }
    };
    if (Array.isArray(data)) data.forEach(push);
    else if (data && typeof data === "object") Object.values(data as Record<string, unknown>).forEach(push);
    return list.filter(Boolean);
}

export function PatientChartShell({
    children,
    patientId,
    patientName,
    patient,
    userRole,
    userName,
}: PatientChartShellProps) {
    const openSidebarRef = React.useRef<(() => void) | null>(null);
    const pathname = usePathname() ?? "";

    const lastSegment = pathname.split("/").pop();
    const isNewVisit = lastSegment === "new-visit";
    const isSendToWaitingRoom = lastSegment === "send-to-waiting-room";
    const isLiveVisit = lastSegment === "live-visit";
    // Fullscreen capture flows render their own chrome — skip the chart
    // ribbon + section nav so the canvas has the whole viewport.
    const isCreateFlow = isNewVisit || isSendToWaitingRoom || isLiveVisit;

    const breadcrumb = React.useMemo<string[]>(() => {
        const segments = pathname.split("/").filter(Boolean);
        return segments.map((segment) => {
            if (segment === "patients") return "Patients";
            if (segment === patientId) return patientName;
            if (segment === "new-visit") return "New visit";
            if (segment === "live-visit") return "Live visit";
            if (segment === "send-to-waiting-room") return "Send to waiting room";
            if (segment === "log-history") return "Visit log";
            return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
        });
    }, [pathname, patientId, patientName]);

    const navItems: NavItem[] = React.useMemo(
        () => [
            { label: "Overview",          icon: Home,         href: `/patients/${patientId}` },
            { label: "Info",              icon: User,         href: `/patients/${patientId}/personal-details` },
            { label: "Vitals",            icon: Activity,     href: `/patients/${patientId}/vitals` },
            { label: "Medications",       icon: Pill,         href: `/patients/${patientId}/medications` },
            { label: "Allergies",         icon: AlertCircle,  href: `/patients/${patientId}/allergies` },
            { label: "Vaccines",          icon: Syringe,      href: `/patients/${patientId}/vaccines` },
            { label: "Visit history",     icon: History,      href: `/patients/${patientId}/visit-history` },
            { label: "Family history",    icon: Users,        href: `/patients/${patientId}/family-history` },
            { label: "Social history",    icon: Speech,       href: `/patients/${patientId}/social-history` },
            { label: "Surgical history",  icon: Stethoscope,  href: `/patients/${patientId}/surgical-history` },
            { label: "Medical history",   icon: FileText,     href: `/patients/${patientId}/past-medical-history` },
            { label: "Orders",            icon: ClipboardList,href: `/patients/${patientId}/orders` },
            { label: "Documents",         icon: Folder,       href: `/patients/${patientId}/documents` },
            { label: "Visit log",         icon: BookOpen,     href: `/patients/${patientId}/log-history` },
        ],
        [patientId]
    );

    const allergiesList = formatAllergiesSummary(patient?.allergies);
    const allergyCount = allergiesList.length || countAllergies(patient?.allergies);
    const dobLabel = patient?.dob ? new Date(patient.dob).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null;
    const mrnShort = patientId.slice(0, 8).toUpperCase();

    const isOverview = pathname === `/patients/${patientId}`;
    const activeHref = React.useMemo(() => {
        if (isOverview) return `/patients/${patientId}`;
        const match = [...navItems]
            .sort((a, b) => b.href.length - a.href.length)
            .find((item) => item.href !== `/patients/${patientId}` && pathname.startsWith(item.href));
        return match?.href ?? `/patients/${patientId}`;
    }, [navItems, pathname, patientId, isOverview]);

    return (
        <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--paper)" }}>
            <SideNav
                userRole={userRole}
                userName={userName}
                patientId={patientId}
                patientName={patientName}
                openMenuRef={openSidebarRef}
            />

            <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
                <TopBar
                    breadcrumb={breadcrumb.length ? breadcrumb : ["Patients"]}
                    onOpenMobileMenu={() => openSidebarRef.current?.()}
                    right={
                        !isCreateFlow ? (
                            <>
                                <Link href={`/patients/${patientId}/live-visit`}>
                                    <Btn kind="ghost" size="md" icon={<Mic className="h-4 w-4" />}>
                                        Live visit
                                    </Btn>
                                </Link>
                                <Link href={`/patients/${patientId}/new-visit`}>
                                    <Btn kind="accent" size="md" icon={<AudioWaveform className="h-4 w-4" />}>
                                        New visit
                                    </Btn>
                                </Link>
                            </>
                        ) : null
                    }
                />

                {!isCreateFlow && (
                    <PatientRibbon
                        name={patientName}
                        avatarUrl={patient?.avatarUrl ?? null}
                        dob={dobLabel}
                        mrn={mrnShort}
                        allergiesText={
                            allergyCount === 0
                                ? null
                                : allergiesList.length > 0
                                    ? allergiesList.join(", ")
                                    : `${allergyCount} recorded`
                        }
                        patientId={patientId}
                    />
                )}

                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {!isCreateFlow && <SectionNav items={navItems} activeHref={activeHref} />}

                    <div className="scroll flex-1 min-w-0 overflow-y-auto" style={{ background: "var(--paper)" }}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PatientRibbon({
    name,
    avatarUrl,
    dob,
    mrn,
    allergiesText,
    patientId,
}: {
    name: string;
    avatarUrl: string | null;
    dob: string | null;
    mrn: string;
    allergiesText: string | null;
    patientId: string;
}) {
    return (
        <div
            className="flex items-center gap-5 px-4 py-4 md:px-8"
            style={{ background: "var(--card)", borderBottom: "1px solid var(--line)" }}
        >
            <Avatar name={name} src={avatarUrl} size={52} />
            <div className="min-w-0 leading-tight">
                <h1
                    className="serif nowrap"
                    style={{ margin: 0, fontSize: 28, letterSpacing: "-0.015em", color: "var(--ink)" }}
                >
                    {name}
                </h1>
                {(dob || allergiesText) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {dob && <StatusPill tone="neutral">DOB {dob}</StatusPill>}
                        {allergiesText && (
                            <StatusPill tone="critical" dot>
                                Allergies
                            </StatusPill>
                        )}
                    </div>
                )}
                <div
                    className="mono mt-1.5 max-w-[520px] truncate text-[11.5px]"
                    style={{ color: "var(--ink-3)" }}
                >
                    MRN {mrn}
                    {allergiesText ? (
                        <>
                            {" · "}
                            <span style={{ color: "var(--critical)" }}>{allergiesText}</span>
                        </>
                    ) : (
                        " · NKDA"
                    )}
                </div>
            </div>
            <div className="flex-1" />
            <div className="hidden items-center gap-1.5 sm:flex">
                <Btn kind="ghost" size="sm" icon={<Phone className="h-3.5 w-3.5" />}>
                    Call
                </Btn>
                <Btn kind="ghost" size="sm" icon={<Send className="h-3.5 w-3.5" />}>
                    Message
                </Btn>
                <Divider orientation="vertical" style={{ height: 22, margin: "0 4px" }} />
                <Link href={`/patients/${patientId}/send-to-waiting-room`}>
                    <Btn kind="soft" size="sm">
                        Send to waiting room
                    </Btn>
                </Link>
            </div>
        </div>
    );
}

function SectionNav({ items, activeHref }: { items: NavItem[]; activeHref: string }) {
    return (
        <aside
            className="hidden shrink-0 flex-col md:flex"
            style={{
                width: 220,
                borderRight: "1px solid var(--line)",
                background: "var(--paper-2)",
            }}
        >
            <div
                className="px-5 pb-2.5 pt-5 text-[10px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
            >
                Chart sections
            </div>
            <nav className="scroll flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
                {items.map((item) => {
                    const isActive = item.href === activeHref;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[12.5px] tracking-tight transition-colors"
                            )}
                            style={{
                                background: isActive ? "var(--paper)" : "transparent",
                                border: `1px solid ${isActive ? "var(--line)" : "transparent"}`,
                                color: isActive ? "var(--ink)" : "var(--ink-2)",
                                fontWeight: isActive ? 500 : 400,
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "var(--paper-3)";
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                            }}
                        >
                            <Icon
                                className="h-[15px] w-[15px]"
                                strokeWidth={1.6}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
