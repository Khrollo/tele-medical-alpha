import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientAllergies } from "@/app/_lib/db/drizzle/queries/allergies";
import { AllergiesContent } from "./allergies-content";

export default async function AllergiesPage({
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

    // Get allergies
    const allergies = await getPatientAllergies(patientId);

    return (
        <AllergiesContent
            patientId={patientId}
            patientName={overview.patient.fullName}
            allergies={allergies}
        />
    );
}

