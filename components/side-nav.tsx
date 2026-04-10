"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, LogOut, Clock, Users, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/app/_lib/utils/cn";
import { createSupabaseBrowserClient } from "@/app/_lib/supabase/client";

interface SideNavProps {
    userRole?: string;
    userName?: string | null;
    patientId?: string;
    patientName?: string;
    onMobileStateChange?: (isOpen: boolean) => void;
    openMenuRef?: React.MutableRefObject<(() => void) | null>;
}

export function SideNav({ userRole, userName, patientId, patientName, onMobileStateChange, openMenuRef }: SideNavProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const [isSigningOut, setIsSigningOut] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Expose open function to parent via ref
    React.useEffect(() => {
        if (openMenuRef) {
            openMenuRef.current = () => setIsOpen(true);
        }
        return () => {
            if (openMenuRef) {
                openMenuRef.current = null;
            }
        };
    }, [openMenuRef]);

    // Notify parent of mobile state changes
    React.useEffect(() => {
        if (onMobileStateChange && isMobile) {
            onMobileStateChange(isOpen);
        }
    }, [isOpen, isMobile, onMobileStateChange]);

    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
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
                // Still redirect even if there's an error
            }

            // Redirect to sign-in page
            router.push("/sign-in");
            router.refresh();
        } catch (err) {
            console.error("Unexpected error during sign out:", err);
            // Still redirect even if there's an error
            router.push("/sign-in");
            router.refresh();
        } finally {
            setIsSigningOut(false);
        }
    };

    // Role-based navigation items
    const navItems = React.useMemo(() => {
        const items: Array<{ href: string; label: string; icon: React.ReactNode }> = [];

        if (userRole === "doctor") {
            items.push({
                href: "/patients",
                label: "Patients",
                icon: <Users className="h-4 w-4" />,
            });
            items.push({
                href: "/waiting-room",
                label: "Schedule",
                icon: <Clock className="h-4 w-4" />,
            });
            items.push({
                href: "/open-notes",
                label: "Inbox",
                icon: <FileText className="h-4 w-4" />,
            });
        }

        if (userRole === "nurse") {
            items.push({
                href: "/patients",
                label: "Patients",
                icon: <Users className="h-4 w-4" />,
            });
            items.push({
                href: "/waiting-room",
                label: "Schedule",
                icon: <Clock className="h-4 w-4" />,
            });
        }

        return items;
    }, [userRole]);

    const isActive = (href: string) => pathname === href;

    // Check if we're on a patient route
    const isOnPatientRoute = React.useMemo(() => {
        if (!pathname || !patientId) return false;
        return pathname.startsWith(`/patients/${patientId}`);
    }, [pathname, patientId]);

    // Mobile drawer overlay
    const mobileOverlay = isOpen && isMobile && (
        <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setIsOpen(false)}
        />
    );

    // Sidebar content
    // On mobile, always show full width when open (ignore collapsed state)
    // On desktop, respect collapsed state
    const sidebarWidth = isMobile ? "w-64" : (isCollapsed ? "w-16" : "w-64");
    // On mobile: show labels when sidebar is open
    // On desktop: show labels when not collapsed
    const showLabels = isMobile ? isOpen : !isCollapsed;
    // For layout/centering: on mobile when closed, center; on desktop when collapsed, center
    const shouldCenter = isMobile ? !isOpen : isCollapsed;

    const sidebarContent = (
        <div
            className={cn(
                "flex h-full flex-col border-r border-border bg-background",
                "fixed left-0 top-0 z-50 md:relative md:z-auto",
                "transition-[width,transform] duration-300 ease-in-out",
                sidebarWidth,
                isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}
        >
            {/* Header */}
            <div className={cn(
                "flex h-16 items-center border-b border-border transition-[padding,justify-content] duration-300 ease-in-out",
                shouldCenter ? "justify-center px-2" : "justify-between px-4"
            )}>
                {showLabels && (
                    <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                        {userName ? (
                            <h2 className="text-sm font-semibold text-foreground truncate">
                                Hello, {userRole === "doctor" ? "Dr. " : userRole === "nurse" ? "Nurse " : ""}{userName}
                            </h2>
                        ) : (
                            <h2 className="text-sm font-semibold text-foreground">Tele Medical</h2>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden md:flex shrink-0"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                        <span className="sr-only">{isCollapsed ? "Expand" : "Collapse"} sidebar</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden shrink-0"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close menu</span>
                    </Button>
                </div>
            </div>

            {/* Navigation */}
            <nav className={cn(
                "flex-1 space-y-1 overflow-y-auto transition-[padding] duration-300 ease-in-out thin-scrollbar",
                shouldCenter ? "p-2" : "p-4"
            )}>
                {/* Search Bar - hidden for now */}

                {/* NAVIGATION Section */}
                <div className={cn("mb-4", shouldCenter && "mb-2")}>
                    {showLabels && (
                        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground animate-in fade-in duration-300">
                            NAVIGATION
                        </p>
                    )}
                    <div className="space-y-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                    "flex items-center rounded-md text-sm transition-colors",
                                    shouldCenter ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    isActive(item.href)
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground"
                                )}
                                title={shouldCenter ? item.label : undefined}
                            >
                                {item.icon}
                                {showLabels && (
                                    <span className="animate-in fade-in duration-300">{item.label}</span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Patient name context - show when on patient route */}
                {isOnPatientRoute && patientId && patientName && showLabels && (
                    <>
                        <div className={cn("border-t border-border", shouldCenter ? "my-2" : "my-4")} />
                        <div className="px-3 py-2 animate-in fade-in duration-300">
                            <h3 className="text-xs font-semibold text-foreground">Patient Name</h3>
                            <p className="text-xs text-muted-foreground truncate mt-1" title={patientName}>{patientName}</p>
                        </div>
                    </>
                )}
            </nav>

            {/* Footer */}
            <div className={cn(
                "border-t border-border transition-[padding] duration-300 ease-in-out",
                shouldCenter ? "p-2 space-y-2" : "p-4 space-y-2"
            )}>
                <div className={cn(
                    shouldCenter ? "flex justify-center" : ""
                )}>
                    <ThemeToggle />
                </div>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full gap-2",
                        shouldCenter ? "justify-center px-2" : "justify-start"
                    )}
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    title={shouldCenter ? (isSigningOut ? "Signing out..." : "Log out") : undefined}
                >
                    <LogOut className="h-4 w-4" />
                    {showLabels && (
                        <span className="animate-in fade-in duration-300">
                            {isSigningOut ? "Signing out..." : "Log out"}
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );

    return (
        <>
            {mobileOverlay}
            {sidebarContent}
        </>
    );
}

