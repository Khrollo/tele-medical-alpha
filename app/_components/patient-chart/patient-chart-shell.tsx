"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/app/_lib/utils/cn";

interface PatientChartShellProps {
    children: React.ReactNode;
    patientId: string;
    patientName: string;
    userRole: string;
}

const medicalSections = [
    { id: "overview", label: "Overview", href: "" },
    { id: "personal", label: "Personal Details", href: "/personal-details" },
    { id: "visits", label: "Visit History", href: "/visit-history" },
    { id: "vitals", label: "Vitals", href: "/vitals" },
    { id: "allergies", label: "Allergies", href: "/allergies" },
    { id: "medications", label: "Medications", href: "/medications" },
    { id: "vaccines", label: "Vaccines", href: "/vaccines" },
    { id: "family", label: "Family History", href: "/family-history" },
    { id: "social", label: "Social History", href: "/social-history" },
    { id: "surgical", label: "Surgical History", href: "/surgical-history" },
    { id: "past-medical", label: "Past Medical History", href: "/past-medical-history" },
    { id: "orders", label: "Orders", href: "/orders" },
    { id: "documents", label: "Documents", href: "/documents" },
    { id: "log", label: "Log History", href: "/log-history" },
];

export function PatientChartShell({
    children,
    patientId,
    patientName,
    userRole,
}: PatientChartShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const basePath = `/patients/${patientId}`;
    
    // Track if we're on the visit page - update when pathname changes
    const [isOnVisitPage, setIsOnVisitPage] = React.useState(false);
    
    React.useEffect(() => {
        const checkVisitPage = () => {
            let onVisitPage = false;
            
            // Check pathname hook first
            if (pathname) {
                onVisitPage = pathname === `${basePath}/new-visit` || 
                    (pathname.includes('/new-visit') && pathname.startsWith(basePath));
            }
            
            // Also check window.location as fallback
            if (!onVisitPage && typeof window !== 'undefined') {
                const currentPath = window.location.pathname;
                onVisitPage = currentPath.includes('/new-visit') && currentPath.includes(basePath);
            }
            
            setIsOnVisitPage(onVisitPage);
        };
        
        checkVisitPage();
    }, [pathname, basePath]);

    const isActive = (sectionHref: string) => {
        if (sectionHref === "") {
            return pathname === basePath || pathname === `${basePath}/overview`;
        }
        return pathname === `${basePath}${sectionHref}`;
    };

    const getNewVisitPath = () => {
        return `/patients/${patientId}/new-visit`;
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Left Icon Rail */}
            <div className="flex w-16 flex-col border-r border-border bg-card">
                <Link
                    href={userRole === "doctor" ? "/waiting-room" : "/patients"}
                    className="flex h-16 items-center justify-center border-b border-border hover:bg-accent transition-colors"
                >
                    <Home className="h-5 w-5 text-muted-foreground" />
                </Link>
                <Link
                    href="/patients"
                    className="flex h-16 items-center justify-center border-b border-border hover:bg-accent transition-colors"
                >
                    <Users className="h-5 w-5 text-muted-foreground" />
                </Link>
            </div>

            {/* Secondary Sidebar */}
            <div className="w-64 border-r border-border bg-card flex flex-col overflow-hidden">
                <div className="border-b border-border p-4">
                    <h2 className="font-semibold text-sm text-foreground">Patient Details</h2>
                    <p className="mt-1 text-xs text-muted-foreground truncate">{patientName}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        MEDICAL SECTIONS
                    </p>
                    <nav className="space-y-1">
                        {medicalSections.map((section) => {
                            const href = `${basePath}${section.href || ""}`;
                            const active = isActive(section.href);
                            
                            // Map section IDs to medical panel section IDs
                            const medicalPanelSectionMap: Record<string, string> = {
                                'medications': 'medications',
                                'vaccines': 'vaccines',
                                'family': 'familyHistory',
                                'surgical': 'surgicalHistory',
                                'past-medical': 'pastMedicalHistory',
                                'allergies': 'allergies',
                                'vitals': 'vitals',
                                'orders': 'orders',
                            };
                            
                            const medicalPanelSectionId = medicalPanelSectionMap[section.id];
                            
                            // If on visit page and section has a medical panel equivalent, use button instead of Link
                            // Use isOnVisitPage from the memoized check (which already checks pathname and basePath)
                            if (isOnVisitPage && medicalPanelSectionId) {
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Trigger a custom event that the visit form can listen to
                                            const event = new CustomEvent('openMedicalPanel', { 
                                                detail: { sectionId: medicalPanelSectionId },
                                                bubbles: true,
                                                cancelable: true
                                            });
                                            window.dispatchEvent(event);
                                        }}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-left",
                                            active
                                                ? "bg-accent text-accent-foreground font-medium"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        )}
                                    >
                                        {section.label}
                                    </button>
                                );
                            }
                            
                            // Regular navigation link (not on visit page or no medical panel equivalent)
                            return (
                                <Link
                                    key={section.id}
                                    href={href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                                        active
                                            ? "bg-accent text-accent-foreground font-medium"
                                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                    )}
                                >
                                    {section.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="flex h-16 items-center gap-4 border-b border-border bg-background px-6">
                    <div className="flex-1">
                        <Input
                            placeholder="Search patients, MRN, or DOB"
                            className="max-w-md"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {/* {userRole === "nurse" && (
                            <Button variant="outline" size="default">
                                Begin Intake
                            </Button>
                        )} */}
                        <Link href={getNewVisitPath()}>
                            <Button size="default">
                                Log New Visit
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto bg-background">
                    {children}
                </div>
            </div>
        </div>
    );
}
