"use client";

import * as React from "react";
import { SideNav } from "@/components/side-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu } from "lucide-react";

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
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <SideNav
        userRole={userRole}
        userName={userName}
        openMenuRef={openSidebarRef}
      />

      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
        <div className="flex h-16 items-center gap-4 border-b border-border bg-background px-6">
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
          <div className="flex-1 min-w-0">
            <Input
              placeholder={
                userRole === "nurse"
                  ? "Search today's schedule..."
                  : "Search today's schedule by name, priority, or appointment type..."
              }
              className="max-w-md w-full"
              id="waiting-room-search"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">{children}</div>
      </div>
    </div>
  );
}
