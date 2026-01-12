"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/side-nav";

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
            />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
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
