import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { PatientChartShell } from "@/app/_components/patient-chart/patient-chart-shell";

export default async function PatientChartLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Check authentication and role
    const session = await getServerSession();

    if (!session) {
        redirect("/sign-in");
    }

    // Allow doctors and nurses
    if (session.role !== "doctor" && session.role !== "nurse") {
        redirect("/sign-in");
    }

    // Verify patient exists
    const overview = await getPatientOverview(id);

    if (!overview) {
        notFound();
    }

    return (
        <div className="flex min-h-screen w-full">
            <PatientChartShell
                patientId={id}
                patientName={overview.patient.fullName}
                userRole={session.role}
                userName={session.name}
            >
                {children}
            </PatientChartShell>
        </div>
    );
}

