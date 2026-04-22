"use client";

import * as React from "react";
import { SideNav } from "@/components/side-nav";
import { TopBar } from "@/components/top-bar";
import { PatientCacheProvider } from "@/app/_components/providers/patient-cache-provider";
import { WorkflowCommandSearch } from "@/components/workflow-command-search";
import { OnboardingHint } from "@/app/_components/onboarding-hint";

interface WaitingRoomShellProps {
  children: React.ReactNode;
  userRole?: string;
  userName?: string | null;
}

export function WaitingRoomShell({
  children,
  userRole,
  userName,
}: WaitingRoomShellProps) {
  const openSidebarRef = React.useRef<(() => void) | null>(null);

  return (
    <PatientCacheProvider>
      <div className="flex h-screen w-full overflow-hidden" style={{ background: "var(--paper)" }}>
        <SideNav userRole={userRole} userName={userName} openMenuRef={openSidebarRef} />

        <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
          <TopBar
            breadcrumb={["Clinic", "Waiting room"]}
            onOpenMobileMenu={() => openSidebarRef.current?.()}
          >
            <WorkflowCommandSearch
              placeholder="Search schedule, inbox, patients, or workflows..."
              className="max-w-md"
            />
          </TopBar>

          <div className="scroll flex-1 overflow-y-auto" style={{ background: "var(--paper)" }}>
            {children}
          </div>
        </div>
      </div>
      <OnboardingHint
        storageKey="waiting-room:v1"
        title="Your schedule at a glance"
        body="Priority and appointment type show at the top of each card. New chips surface vitals, lab, and imaging status so you can triage without opening every chart. Tap a card to expand the snapshot."
        anchor="bottom-right"
      />
    </PatientCacheProvider>
  );
}
