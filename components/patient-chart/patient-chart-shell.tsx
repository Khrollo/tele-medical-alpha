"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, Menu, X, ChevronLeft, ChevronRight, LogOut, Clock, FileText, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/app/_lib/utils/cn";
import { createSupabaseBrowserClient } from "@/app/_lib/supabase/client";

interface PatientChartShellProps {
  children: React.ReactNode;
  patientId: string;
  patientName: string;
  userRole: string;
  userName?: string | null;
}

const medicalSections = [
  { id: "overview", label: "Overview", href: "" },
  { id: "personal", label: "Personal Details", href: "/personal-details" },
  { id: "visits", label: "Visit History", href: "/visit-history" },
  { id: "vitals", label: "Vitals", href: "/vitals" },
  { id: "allergies", label: "Allergies", href: "/allergies" },
  { id: "medications", label: "Medications", href: "/medications" },
  { id: "vaccines", label: "Vaccines", href: "/vaccines" },
  { id: "family", label: "Family History", href: "/family-history" },
  { id: "social", label: "Social History", href: "/social-history" },
  { id: "surgical", label: "Surgical History", href: "/surgical-history" },
  { id: "past-medical", label: "Past Medical History", href: "/past-medical-history" },
  { id: "orders", label: "Orders", href: "/orders" },
  { id: "documents", label: "Documents", href: "/documents" },
  { id: "log", label: "Log History", href: "/log-history" },
];

export function PatientChartShell({
  children,
  patientId,
  patientName,
  userRole,
  userName,
}: PatientChartShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = `/patients/${patientId}`;
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  // Track if we're on the visit page - update when pathname changes
  const [isOnVisitPage, setIsOnVisitPage] = React.useState(false);

  React.useEffect(() => {
    const checkVisitPage = () => {
      let onVisitPage = false;

      // Check pathname hook first
      if (pathname) {
        onVisitPage = pathname === `${basePath}/new-visit` ||
          (pathname.includes('/new-visit') && pathname.startsWith(basePath));
      }

      // Also check window.location as fallback
      if (!onVisitPage && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        onVisitPage = currentPath.includes('/new-visit') && currentPath.includes(basePath);
      }

      setIsOnVisitPage(onVisitPage);
    };

    checkVisitPage();
  }, [pathname, basePath]);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // On desktop, start with sidebar open
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Error signing out:", error);
      }

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

  const isActive = (sectionHref: string) => {
    if (sectionHref === "") {
      return pathname === basePath || pathname === `${basePath}/overview`;
    }
    return pathname === `${basePath}${sectionHref}`;
  };

  const getNewVisitPath = () => {
    return `/patients/${patientId}/new-visit`;
  };

  const getHomePath = () => {
    return userRole === "doctor" ? "/waiting-room" : "/patients";
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const mobileOverlay = isSidebarOpen && isMobile && (
    <div
      className="fixed inset-0 z-40 bg-black/50 md:hidden"
      onClick={() => setIsSidebarOpen(false)}
    />
  );

  return (
    <>
      {mobileOverlay}
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Secondary Sidebar - Collapsible */}
        <div
          className={cn(
            "border-r border-border bg-card flex flex-col overflow-hidden transition-all duration-300",
            "fixed left-0 top-0 z-[100] h-full md:relative md:z-auto",
            isMobile
              ? isSidebarOpen
                ? "w-64 translate-x-0"
                : "-translate-x-full"
              : isSidebarCollapsed
                ? "w-0 md:w-16"
                : "w-64"
          )}
        >
          {/* Sidebar Header */}
          <div className="border-b border-border p-4 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                {userName ? (
                  <h2 className="font-semibold text-sm text-foreground truncate">
                    Hello, {userRole === "doctor" ? "Dr. " : userRole === "nurse" ? "Nurse " : ""}{userName}
                  </h2>
                ) : (
                  <h2 className="font-semibold text-sm text-foreground">Patient Details</h2>
                )}
                <p className="mt-1 text-xs text-muted-foreground truncate">{patientName}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 ml-2 md:ml-0"
              onClick={toggleSidebar}
            >
              {isMobile ? (
                <X className="h-4 w-4" />
              ) : isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </div>

          {/* Navigation & Medical Sections */}
          {(!isSidebarCollapsed || isMobile) && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Main Navigation */}
              <div className="p-2 border-b border-border">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  NAVIGATION
                </p>
                <nav className="space-y-1">
                  {userRole === "doctor" && (
                    <Link
                      href={getHomePath()}
                      onClick={() => {
                        if (isMobile) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <>
                        <Clock className="h-4 w-4" />
                        Waiting Room
                      </>

                    </Link>
                  )}
                  <Link
                    href="/patients"
                    onClick={() => {
                      if (isMobile) {
                        setIsSidebarOpen(false);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Patients
                  </Link>
                  {userRole === "doctor" && (
                    <Link
                      href="/open-notes"
                      onClick={() => {
                        if (isMobile) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <FileText className="h-4 w-4" />
                      Open Notes
                    </Link>
                  )}
                  {(userRole === "doctor" || userRole === "nurse") && (
                    <Link
                      href="/patients/new"
                      onClick={() => {
                        if (isMobile) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <UserPlus className="h-4 w-4" />
                      New Patient
                    </Link>
                  )}
                </nav>
              </div>

              {/* Medical Sections */}
              <div className="flex-1 overflow-y-auto p-2">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  MEDICAL SECTIONS
                </p>
                <nav className="space-y-1">
                  {medicalSections.map((section) => {
                    const href = `${basePath}${section.href || ""}`;
                    const active = isActive(section.href);

                    // Map section IDs to medical panel section IDs
                    const medicalPanelSectionMap: Record<string, string> = {
                      'overview': 'overview',
                      'personal': 'personalDetails',
                      'visits': 'visitHistory',
                      'social': 'socialHistory',
                      'medications': 'medications',
                      'vaccines': 'vaccines',
                      'family': 'familyHistory',
                      'surgical': 'surgicalHistory',
                      'past-medical': 'pastMedicalHistory',
                      'allergies': 'allergies',
                      'vitals': 'vitals',
                      'orders': 'orders',
                    };

                    const medicalPanelSectionId = medicalPanelSectionMap[section.id];

                    // If on visit page and section has a medical panel equivalent, use button instead of Link
                    if (isOnVisitPage && medicalPanelSectionId) {
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isMobile) {
                              setIsSidebarOpen(false);
                            }
                            // Trigger a custom event that the visit form can listen to
                            const event = new CustomEvent('openMedicalPanel', {
                              detail: { sectionId: medicalPanelSectionId },
                              bubbles: true,
                              cancelable: true
                            });
                            window.dispatchEvent(event);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors text-left cursor-pointer",
                            active
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          {section.label}
                        </button>
                      );
                    }

                    // Regular navigation link (not on visit page or no medical panel equivalent)
                    return (
                      <Link
                        key={section.id}
                        href={href}
                        onClick={() => {
                          if (isMobile) {
                            setIsSidebarOpen(false);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        {section.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Footer with Theme Toggle and Logout */}
          {(!isSidebarCollapsed || isMobile) && (
            <div className="border-t border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? "Signing out..." : "Log out"}
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="flex h-16 items-center gap-2 md:gap-4 border-b border-border bg-background px-3 md:px-6">
            {/* Mobile Menu Button - Only show when sidebar is closed */}
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden fixed left-4 top-4 z-50 bg-background/95 backdrop-blur-sm shadow-md"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            )}

            <div className="flex-1 min-w-0">
              <Input
                placeholder="Search patients, MRN, or DOB"
                className="w-full max-w-md hidden md:block"
              />
              {/* Mobile: Show patient name */}
              <h1 className="text-lg font-semibold md:hidden truncate">{patientName}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile: Quick theme toggle */}
              <div className="md:hidden">
                <ThemeToggle />
              </div>
              {/* {userRole === "nurse" && (
                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Begin Intake</span>
                  <span className="sm:hidden">Intake</span>
                </Button>
              )} */}
              <Link href={getNewVisitPath()}>
                <Button size="sm" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Log New Visit</span>
                  <span className="sm:hidden">New Visit</span>
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
    </>
  );
}
