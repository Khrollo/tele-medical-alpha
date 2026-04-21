import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { LiveVisitScreen } from "./live-visit-screen";

export const dynamic = "force-dynamic";

export default async function LiveVisitPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getServerSession();
    if (!session) redirect("/sign-in");

    // Only clinicians run the live-visit capture UI.
    if (session.role !== "doctor" && session.role !== "nurse") {
        redirect(`/patients/${id}`);
    }

    const overview = await getPatientOverview(id);
    if (!overview) notFound();

    return (
        <LiveVisitScreen
            patientId={id}
            patient={{
                fullName: overview.patient.fullName,
                dob: overview.patient.dob,
                allergies: overview.patient.allergies,
                vitals: overview.patient.vitals,
            }}
            userId={session.id}
            userRole={session.role}
        />
    );
}
