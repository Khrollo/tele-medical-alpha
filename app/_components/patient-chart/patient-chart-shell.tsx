"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/side-nav";
import { cn } from "@/app/_lib/utils/cn";
import { Menu, ChevronRight, Home } from "lucide-react";

interface PatientChartShellProps {
    children: React.ReactNode;
    patientId: string;
    patientName: string;
    userRole: string;
    userName?: string | null;
}

export function PatientChartShell({
    children,
    patientId,
    patientName,
    userRole,
    userName,
}: PatientChartShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const openSidebarRef = React.useRef<(() => void) | null>(null);
    const pathname = usePathname();

    const getNewVisitPath = () => {
        return `/patients/${patientId}/new-visit`;
    };

    const pathSegments = pathname.split("/").filter(Boolean);
    const breadcrumbs = pathSegments.map((segment, index) => {
        const href = "/" + pathSegments.slice(0, index + 1).join("/");
        
        let label = segment;
        if (segment === "patients") label = "Patients";
        else if (segment === patientId) label = patientName;
        else if (segment === "new-visit") label = "New Visit";
        else if (segment === "lab-results") label = "Lab Results";
        else if (segment === "documents") label = "Documents";
        else if (segment === "messages") label = "Messages";
        else if (segment === "history") label = "Patient History";
        else {
            label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
        }
        
        return { href, label, isLast: index === pathSegments.length - 1 };
    });

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* SideNav with patient info */}
            <SideNav
                userRole={userRole}
                userName={userName}
                patientId={patientId}
                patientName={patientName}
                onMobileStateChange={setIsSidebarOpen}
                openMenuRef={openSidebarRef}
            />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
                {/* Top Bar */}
                <div className="flex h-16 items-center gap-4 border-b border-border bg-background px-6">
                    {/* Mobile hamburger button - inline with search */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden shrink-0"
                        onClick={() => {
                            openSidebarRef.current?.();
                        }}
                    >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                    <div className="flex-1 min-w-0 flex items-center text-sm overflow-x-auto thin-scrollbar">
                        <Link href="/patients" className="text-muted-foreground hover:text-foreground transition-colors flex items-center shrink-0">
                            <Home className="h-4 w-4" />
                        </Link>
                        {breadcrumbs.map((bc, i) => (
                            <React.Fragment key={bc.href}>
                                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/50 shrink-0" />
                                {bc.isLast ? (
                                    <span className="font-semibold text-foreground truncate">{bc.label}</span>
                                ) : (
                                    <Link href={bc.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                                        {bc.label}
                                    </Link>
                                )}
                            </React.Fragment>
                        ))}
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
