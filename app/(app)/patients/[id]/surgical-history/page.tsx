import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientSurgicalHistory } from "@/app/_lib/db/drizzle/queries/surgical-history";
import { SurgicalHistoryContent } from "./surgical-history-content";

export default async function SurgicalHistoryPage({
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

  // Get surgical history
  const surgicalHistory = await getPatientSurgicalHistory(patientId);

  return (
    <SurgicalHistoryContent
      patientId={patientId}
      patientName={overview.patient.fullName}
      surgicalHistory={surgicalHistory}
    />
  );
}

