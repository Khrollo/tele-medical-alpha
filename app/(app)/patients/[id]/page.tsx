import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { PatientOverviewCards } from "./patient-overview-cards";

export default async function PatientOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    redirect("/sign-in");
  }

  const overview = await getPatientOverview(id);

  if (!overview) {
    notFound();
  }

  return (
    <PatientOverviewCards
      patient={overview.patient}
      stats={overview.stats}
      latestVisit={overview.latestVisit}
      recentVisits={overview.recentVisits}
      recentResults={overview.recentResults}
      userRole={session.role}
    />
  );
}
