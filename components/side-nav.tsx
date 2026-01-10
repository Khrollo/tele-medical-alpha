"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/app/_lib/utils/cn";
import { createSupabaseBrowserClient } from "@/app/_lib/supabase/client";

interface SideNavProps {
    userRole?: string;
    userName?: string | null;
}

export function SideNav({ userRole, userName }: SideNavProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);
    const [isSigningOut, setIsSigningOut] = React.useState(false);
    const pathname = usePathname();
    const router = useRouter();

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
        const items: Array<{ href: string; label: string }> = [];

        if (userRole === "doctor") {
            items.push({
                href: "/waiting-room",
                label: "Waiting Room",
            });
            items.push({
                href: "/open-notes",
                label: "Open Notes",
            });
        }

        if (userRole === "nurse") {
            items.push({
                href: "/patients",
                label: "Patients",
            });
        }

        // Both doctors and nurses can create patients
        if (userRole === "doctor" || userRole === "nurse") {
            items.push({
                href: "/patients/new",
                label: "Create Patient",
            });
        }

        return items;
    }, [userRole]);

    const isActive = (href: string) => pathname === href;

    // Mobile drawer overlay
    const mobileOverlay = isOpen && isMobile && (
        <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setIsOpen(false)}
        />
    );

    // Sidebar content
    const sidebarContent = (
        <div
            className={cn(
                "flex h-full w-64 flex-col border-r border-border bg-background",
                "fixed left-0 top-0 z-50 transform transition-transform duration-300 md:relative md:z-auto md:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}
        >
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <div className="flex-1 min-w-0">
                    {userName ? (
                        <h2 className="text-lg font-semibold text-foreground truncate">
                            Hello, {userRole === "doctor" ? "Dr. " : userRole === "nurse" ? "Nurse " : ""}{userName}
                        </h2>
                    ) : (
                        <h2 className="text-lg font-semibold text-foreground">Tele Medical</h2>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden flex-shrink-0 ml-2"
                    onClick={() => setIsOpen(false)}
                >
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close menu</span>
                </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            isActive(item.href)
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4 space-y-2">
                <ThemeToggle />
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
        </div>
    );

    return (
        <>
            {/* Mobile menu button */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed left-4 top-4 z-[100] md:hidden bg-background/95 backdrop-blur-sm shadow-md"
                onClick={() => setIsOpen(true)}
            >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
            </Button>

            {mobileOverlay}
            {sidebarContent}
        </>
    );
}

