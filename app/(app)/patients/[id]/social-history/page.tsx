import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientSocialHistory } from "@/app/_lib/db/drizzle/queries/social-history";
import { SocialHistoryContent } from "./social-history-content";

export default async function SocialHistoryPage({
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

  // Get social history
  const socialHistory = await getPatientSocialHistory(patientId);

  return (
    <SocialHistoryContent
      patientId={patientId}
      patientName={overview.patient.fullName}
      socialHistory={socialHistory}
    />
  );
}

