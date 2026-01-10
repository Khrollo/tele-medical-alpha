import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientDocumentsAction } from "@/app/_actions/documents";
import { DocumentsContent } from "./documents-content";

export default async function DocumentsPage({
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

  // Get documents
  const documents = await getPatientDocumentsAction(patientId);

  return (
    <DocumentsContent
      patientId={patientId}
      patientName={overview.patient.fullName}
      documents={documents}
    />
  );
}

