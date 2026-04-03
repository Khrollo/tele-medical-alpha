"use client";

import * as React from "react";
import { SideNav } from "@/components/side-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu } from "lucide-react";

interface PatientsShellProps {
    children: React.ReactNode;
    userRole?: string;
    userName?: string | null;
}

export function PatientsShell({ children, userRole, userName }: PatientsShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const openSidebarRef = React.useRef<(() => void) | null>(null);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50/30 dark:bg-transparent">
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
                <div className="flex h-20 items-center gap-4 border-b border-slate-100 bg-white/80 backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800 px-8 sticky top-0 z-10">
                    {/* Mobile hamburger button - inline with search */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden shrink-0 hover:bg-slate-100 rounded-xl"
                        onClick={() => {
                            openSidebarRef.current?.();
                        }}
                    >
                        <Menu className="h-5 w-5 text-slate-600" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                    <div className="flex-1 min-w-0 max-w-xl relative">
                        <Input
                            placeholder="Find patient by name, phone, or clinician..."
                            className="w-full pl-12 h-11 rounded-2xl bg-slate-50 border-none shadow-none focus-visible:ring-2 focus-visible:ring-slate-200 transition-all text-sm font-medium"
                            id="patients-search"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
