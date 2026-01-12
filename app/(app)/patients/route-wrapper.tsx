"use client";

import { SideNav } from "@/components/side-nav";
import { usePathname } from "next/navigation";
import * as React from "react";

interface RouteWrapperProps {
  children: React.ReactNode;
  userRole?: string;
  userName?: string | null;
}

export function RouteWrapper({ children, userRole, userName }: RouteWrapperProps) {
  const pathname = usePathname();

  // Check if we're on a dynamic patient route (e.g., /patients/[id])
  // UUID pattern: 8-4-4-4-12 hex characters
  const isDynamicPatientRoute = React.useMemo(() => {
    if (!pathname) return false;
    return /^\/patients\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pathname);
  }, [pathname]);

  // Check if we're on the create patient page or patients list page
  const isCreatePatientPage = pathname === "/patients/new";
  const isPatientsListPage = pathname === "/patients";

  // If we're on a dynamic patient route, create patient page, or patients list page, don't wrap with SideNav
  // The PatientChartShell, CreatePatientShell, and PatientsShell handle their own navigation
  if (isDynamicPatientRoute || isCreatePatientPage || isPatientsListPage) {
    return <>{children}</>;
  }

  // For the /patients list page, use SideNav
  return (
    <div className="flex min-h-screen w-full">
      <SideNav userRole={userRole} userName={userName} />
      <main className="flex flex-1 flex-col overflow-hidden pl-14 md:pl-0">
        {children}
      </main>
    </div>
  );
}

