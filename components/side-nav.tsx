"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  X,
  LogOut,
  Clock,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { Logo } from "./ui/clearing/logo";
import { Avatar } from "./ui/clearing/avatar";
import { Divider } from "./ui/clearing/divider";
import { cn } from "@/app/_lib/utils/cn";
import { authClient } from "@/app/_lib/auth/auth-client";

interface SideNavProps {
  userRole?: string;
  userName?: string | null;
  patientId?: string;
  patientName?: string;
  onMobileStateChange?: (isOpen: boolean) => void;
  openMenuRef?: React.MutableRefObject<(() => void) | null>;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export function SideNav({
  userRole,
  userName,
  patientId,
  patientName,
  onMobileStateChange,
  openMenuRef,
}: SideNavProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (openMenuRef) {
      openMenuRef.current = () => setIsOpen(true);
    }
    return () => {
      if (openMenuRef) openMenuRef.current = null;
    };
  }, [openMenuRef]);

  React.useEffect(() => {
    if (onMobileStateChange && isMobile) onMobileStateChange(isOpen);
  }, [isOpen, isMobile, onMobileStateChange]);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    } catch (err) {
      console.error("Unexpected error during sign out:", err);
      router.push("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  const navItems = React.useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    if (userRole === "doctor") {
      items.push(
        { href: "/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
        { href: "/waiting-room", label: "Schedule", icon: <Clock className="h-4 w-4" /> },
        { href: "/open-notes", label: "Open notes", icon: <FileText className="h-4 w-4" /> }
      );
    }
    if (userRole === "nurse") {
      items.push(
        { href: "/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
        { href: "/waiting-room", label: "Schedule", icon: <Clock className="h-4 w-4" /> }
      );
    }
    if (userRole === "admin") {
      items.push({
        href: "/admin/users/new",
        label: "User admin",
        icon: <UserPlus className="h-4 w-4" />,
      });
    }
    return items;
  }, [userRole]);

  const isActive = (href: string) => pathname === href;

  const isOnPatientRoute = React.useMemo(() => {
    if (!pathname || !patientId) return false;
    return pathname.startsWith(`/patients/${patientId}`);
  }, [pathname, patientId]);

  const sidebarWidth = isMobile ? "w-64" : isCollapsed ? "w-16" : "w-64";
  const showLabels = isMobile ? isOpen : !isCollapsed;
  const shouldCenter = isMobile ? !isOpen : isCollapsed;

  const hasHonorific = !!userName && /^(dr\.?|nurse|mr\.?|ms\.?|mrs\.?)\s/i.test(userName);
  const roleTitle =
    hasHonorific ? "" : userRole === "doctor" ? "Dr. " : userRole === "nurse" ? "Nurse " : "";
  const displayName = userName ? `${roleTitle}${userName}` : "Tele Medical";
  const roleLabel =
    userRole === "doctor" ? "Clinician" : userRole === "nurse" ? "Triage nurse" : "";

  const mobileOverlay = isOpen && isMobile && (
    <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />
  );

  const sidebarContent = (
    <aside
      className={cn(
        "flex h-full flex-col",
        "fixed left-0 top-0 z-50 md:relative md:z-auto",
        "transition-[width,transform] duration-300 ease-in-out",
        sidebarWidth,
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
      style={{
        background: "var(--paper-2)",
        borderRight: "1px solid var(--line)",
      }}
    >
      {/* Brand block */}
      <div
        className={cn(
          "flex h-16 items-center transition-[padding] duration-300 ease-in-out",
          shouldCenter ? "justify-center px-2" : "justify-between px-4"
        )}
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className={cn("flex min-w-0 items-center gap-2.5", shouldCenter && "justify-center")}>
          <span style={{ color: "var(--ink)" }}>
            <Logo size={showLabels ? 26 : 24} />
          </span>
          {showLabels && (
            <div className="min-w-0 animate-in fade-in duration-300">
              <div className="serif truncate text-[15px] leading-none" style={{ color: "var(--ink)" }}>
                Tele Medical
              </div>
              <div
                className="mt-0.5 text-[9.5px] uppercase tracking-[0.14em]"
                style={{ color: "var(--ink-3)" }}
              >
                Urgent Care
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--paper-3)]"
            style={{ color: "var(--ink-3)" }}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="md:hidden h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--paper-3)] inline-flex"
            style={{ color: "var(--ink-3)" }}
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto thin-scrollbar transition-[padding] duration-300 ease-in-out",
          shouldCenter ? "p-2" : "px-3 py-4"
        )}
      >
        <div className="mb-4">
          {showLabels && (
            <p
              className="px-3 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.14em] animate-in fade-in duration-300"
              style={{ color: "var(--ink-3)" }}
            >
              Clinic
            </p>
          )}
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  title={shouldCenter ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-[10px] text-[13.5px] transition-colors",
                    shouldCenter ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                    active ? "font-medium" : "font-normal"
                  )}
                  style={{
                    background: active ? "var(--paper)" : "transparent",
                    border: active ? "1px solid var(--line)" : "1px solid transparent",
                    color: active ? "var(--ink)" : "var(--ink-2)",
                    boxShadow: active ? "0 1px 0 oklch(0 0 0 / 0.02)" : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "var(--paper-3)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  }}
                >
                  <span style={{ color: active ? "var(--brand-ink)" : "var(--ink-3)" }}>
                    {item.icon}
                  </span>
                  {showLabels && <span className="flex-1 animate-in fade-in duration-300">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {isOnPatientRoute && patientId && patientName && showLabels && (
          <>
            <Divider />
            <div className="px-3 py-3 animate-in fade-in duration-300">
              <div
                className="text-[10px] font-medium uppercase tracking-[0.14em]"
                style={{ color: "var(--ink-3)" }}
              >
                Patient
              </div>
              <p
                className="mt-1 truncate text-[13px] font-medium"
                style={{ color: "var(--ink)" }}
                title={patientName}
              >
                {patientName}
              </p>
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "transition-[padding] duration-300 ease-in-out",
          shouldCenter ? "space-y-2 p-2" : "space-y-2 p-3"
        )}
        style={{ borderTop: "1px solid var(--line)" }}
      >
        {showLabels && userName && (
          <div
            className="flex items-center gap-2.5 rounded-xl p-2.5 animate-in fade-in duration-300"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
            }}
          >
            <Avatar name={userName} size={28} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                {displayName}
              </div>
              {roleLabel && (
                <div className="truncate text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                  {roleLabel}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          title={shouldCenter ? (isSigningOut ? "Signing out..." : "Log out") : undefined}
          className={cn(
            "flex w-full items-center rounded-md text-[13px] transition-colors",
            shouldCenter ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
            "disabled:opacity-60"
          )}
          style={{ color: "var(--ink-2)", background: "transparent" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--paper-3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {showLabels && (
            <span className="animate-in fade-in duration-300">
              {isSigningOut ? "Signing out..." : "Log out"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {mobileOverlay}
      {sidebarContent}
    </>
  );
}
