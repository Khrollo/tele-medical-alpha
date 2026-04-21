"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SideNav } from "@/components/side-nav";
import { TopBar } from "@/components/top-bar";

interface CreatePatientShellProps {
    children: React.ReactNode;
    userRole?: string;
    userName?: string | null;
}

export function CreatePatientShell({ children, userRole, userName }: CreatePatientShellProps) {
    const router = useRouter();
    const openSidebarRef = React.useRef<(() => void) | null>(null);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            const searchValue = (e.target as HTMLInputElement).value.trim();
            if (searchValue) {
                router.push(`/patients?search=${encodeURIComponent(searchValue)}`);
            } else {
                router.push("/patients");
            }
        }
    };

    React.useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalStyle;
            document.documentElement.style.overflow = originalStyle;
        };
    }, []);

    return (
        <div className="fixed inset-0 flex overflow-hidden" style={{ background: "var(--paper)" }}>
            <SideNav
                userRole={userRole}
                userName={userName}
                openMenuRef={openSidebarRef}
            />

            <div className="flex flex-1 flex-col min-w-0 overflow-hidden transition-all duration-300 ease-in-out">
                <TopBar
                    breadcrumb={["Patients", "New patient"]}
                    onOpenMobileMenu={() => openSidebarRef.current?.()}
                >
                    <label
                        className="flex h-9 items-center gap-2 rounded-md px-3 text-[13px]"
                        style={{
                            flex: "0 1 340px",
                            background: "var(--paper-2)",
                            border: "1px solid var(--line)",
                            color: "var(--ink-3)",
                        }}
                    >
                        <Search className="h-3.5 w-3.5" />
                        <input
                            placeholder="Search patients, MRN, or DOB (press Enter)"
                            className="min-w-0 flex-1 border-0 bg-transparent outline-none"
                            style={{ color: "var(--ink)" }}
                            id="create-patient-search"
                            onKeyDown={handleSearch}
                        />
                    </label>
                </TopBar>

                <div className="scroll flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ background: "var(--paper)" }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
