import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientPastMedicalHistoryAction } from "@/app/_actions/past-medical-history";
import { PastMedicalHistoryContent } from "./past-medical-history-content";

export default async function PastMedicalHistoryPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: patientId } = await params;

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
    const overview = await getPatientOverview(patientId);

    if (!overview) {
        notFound();
    }

    // Get past medical history
    const pastMedicalHistory = await getPatientPastMedicalHistoryAction(patientId);

    return (
        <PastMedicalHistoryContent
            patientId={patientId}
            patientName={overview.patient.fullName}
            pastMedicalHistory={pastMedicalHistory}
        />
    );
}

