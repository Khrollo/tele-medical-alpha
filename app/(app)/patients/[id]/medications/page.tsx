import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientMedications } from "@/app/_lib/db/drizzle/queries/medications";
import { MedicationsContent } from "./medications-content";

export default async function MedicationsPage({
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

  // Get medications
  const medications = await getPatientMedications(patientId);

  return (
    <MedicationsContent
      patientId={patientId}
      patientName={overview.patient.fullName}
      medications={medications}
    />
  );
}

