import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientVisitLogs } from "@/app/_lib/db/drizzle/queries/visit-log";
import { LogHistoryContent } from "./log-history-content";

interface LogHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function LogHistoryPage({ params }: LogHistoryPageProps) {
  const { id: patientId } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    redirect("/");
  }

  const result = await getPatientVisitLogs(patientId);

  if (!result) {
    notFound();
  }

  return <LogHistoryContent patientId={patientId} data={result} />;
}
