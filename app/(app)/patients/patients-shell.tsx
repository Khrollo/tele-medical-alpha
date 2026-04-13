"use client";

import * as React from "react";
import { SideNav } from "@/components/side-nav";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { WorkflowCommandSearch } from "@/components/workflow-command-search";

interface PatientsShellProps {
    children: React.ReactNode;
    userRole?: string;
    userName?: string | null;
}

export function PatientsShell({ children, userRole, userName }: PatientsShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const openSidebarRef = React.useRef<(() => void) | null>(null);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* SideNav */}
            <SideNav
                userRole={userRole}
                userName={userName}
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
                    <div className="flex-1 min-w-0 max-w-md relative">
                        <WorkflowCommandSearch placeholder="Search patients, visits, or workflows..." />
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
