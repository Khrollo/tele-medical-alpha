import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientFamilyHistory } from "@/app/_lib/db/drizzle/queries/family-history";
import { FamilyHistoryContent } from "./family-history-content";

export default async function FamilyHistoryPage({
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

  // Get family history
  const familyHistory = await getPatientFamilyHistory(patientId);

  return (
    <FamilyHistoryContent
      patientId={patientId}
      patientName={overview.patient.fullName}
      familyHistory={familyHistory}
    />
  );
}

