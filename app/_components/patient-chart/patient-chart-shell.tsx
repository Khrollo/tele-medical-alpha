"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/side-nav";
import { Menu } from "lucide-react";

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
    const openSidebarRef = React.useRef<(() => void) | null>(null);
    const getNewVisitPath = () => {
        return `/patients/${patientId}/new-visit`;
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* SideNav with patient info */}
            <SideNav
                userRole={userRole}
                userName={userName}
                patientId={patientId}
                patientName={patientName}
                openMenuRef={openSidebarRef}
            />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
                {/* Top Bar */}
                <div className="relative z-50 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
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
                        {breadcrumbs.map((bc) => (
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
                        <Button asChild size="default">
                            <Link href={getNewVisitPath()}>
                                Log New Visit
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Patient Dashboard Sub Navigation (Hidden for New Visit) */}
                {pathname.split("/").pop() !== "new-visit" && (
                  <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="flex items-center justify-start gap-8 px-8 overflow-x-auto thin-scrollbar no-scrollbar scroll-smooth">
                      {[
                        { label: "Overview", icon: Home, href: `/patients/${patientId}` },
                        { label: "Info", icon: User, href: `/patients/${patientId}/personal-details` },
                        { label: "Vitals", icon: Activity, href: `/patients/${patientId}/vitals` },
                        { label: "Meds", icon: Pill, href: `/patients/${patientId}/medications` },
                        { label: "Allergies", icon: AlertCircle, href: `/patients/${patientId}/allergies` },
                        { label: "Vaccines", icon: Syringe, href: `/patients/${patientId}/vaccines` },
                        { label: "Visits", icon: History, href: `/patients/${patientId}/visit-history` },
                        { label: "Family", icon: Users, href: `/patients/${patientId}/family-history` },
                        { label: "Social", icon: Speech, href: `/patients/${patientId}/social-history` },
                        { label: "Surgical", icon: Stethoscope, href: `/patients/${patientId}/surgical-history` },
                        { label: "Medical", icon: FileText, href: `/patients/${patientId}/past-medical-history` },
                        { label: "Orders", icon: ClipboardList, href: `/patients/${patientId}/orders` },
                        { label: "Documents", icon: Folder, href: `/patients/${patientId}/documents` },
                        { label: "Messages", icon: MessageSquare, href: `/patients/${patientId}/messages` },
                        { label: "Visit Log", icon: BookOpen, href: `/patients/${patientId}/log-history` },
                      ].map((item) => {
                        const isActive = pathname === item.href || (item.label === "Overview" && pathname === `/patients/${patientId}`);
                        return (
                          <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                              "flex flex-col items-center gap-1.5 pt-4 pb-3 transition-all relative group",
                              isActive ? "text-black dark:text-white opacity-100" : "text-black dark:text-white opacity-70 hover:opacity-90"
                            )}
                          >
                            <item.icon className={cn(
                              "h-5 w-5 stroke-[1.5]",
                              isActive ? "text-black dark:text-white" : "text-black dark:text-white"
                            )} />
                            <span className={cn(
                              "text-xs font-bold tracking-tight",
                              isActive ? "opacity-100" : "opacity-100"
                            )}>
                              {item.label}
                            </span>
                            
                            {/* Active Indicator Line */}
                            {isActive && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-t-full" />
                            )}
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                )}

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto bg-background">
                    {children}
                </div>
            </div>
        </div>
    );
}
