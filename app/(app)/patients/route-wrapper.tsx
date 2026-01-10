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

  // If we're on a dynamic patient route, don't wrap with SideNav
  // The PatientChartShell handles its own navigation
  if (isDynamicPatientRoute) {
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

