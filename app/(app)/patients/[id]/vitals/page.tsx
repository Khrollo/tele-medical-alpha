import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientVitalsAction } from "@/app/_actions/vitals";
import { VitalsContent } from "./vitals-content";

export default async function VitalsPage({
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

    // Get vitals
    const vitals = await getPatientVitalsAction(patientId);

    return (
        <VitalsContent
            patientId={patientId}
            patientName={overview.patient.fullName}
            vitals={vitals}
        />
    );
}

