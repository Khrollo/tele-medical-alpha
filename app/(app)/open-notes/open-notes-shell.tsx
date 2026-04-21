"use client";

import * as React from "react";
import { SideNav } from "@/components/side-nav";
import { TopBar } from "@/components/top-bar";
import { WorkflowCommandSearch } from "@/components/workflow-command-search";

interface OpenNotesShellProps {
    children: React.ReactNode;
    userRole?: string;
    userName?: string | null;
}

export function OpenNotesShell({ children, userRole, userName }: OpenNotesShellProps) {
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
                    breadcrumb={["Clinic", "Open notes"]}
                    onOpenMobileMenu={() => openSidebarRef.current?.()}
                >
                    <WorkflowCommandSearch
                        placeholder="Search inbox, patients, or workflows..."
                        className="max-w-md"
                    />
                </TopBar>

                <div className="scroll flex-1 overflow-y-auto" style={{ background: "var(--paper)" }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
