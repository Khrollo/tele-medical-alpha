"use client";

import * as React from "react";
import { SideNav } from "@/components/side-nav";
import { TopBar } from "@/components/top-bar";
import { WorkflowCommandSearch } from "@/components/workflow-command-search";

interface PatientsShellProps {
    children: React.ReactNode;
    userRole?: string;
    userName?: string | null;
}

export function PatientsShell({ children, userRole, userName }: PatientsShellProps) {
    const openSidebarRef = React.useRef<(() => void) | null>(null);

    return (
        <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--paper)" }}>
            <SideNav
                userRole={userRole}
                userName={userName}
                openMenuRef={openSidebarRef}
            />

            <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
                <TopBar
                    breadcrumb={["Clinic", "Patients"]}
                    onOpenMobileMenu={() => openSidebarRef.current?.()}
                >
                    <div className="max-w-md">
                        <WorkflowCommandSearch placeholder="Search patients, visits, or workflows..." />
                    </div>
                </TopBar>

                <div className="scroll flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
