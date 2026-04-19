import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/app/_lib/auth/get-current-user";
import { getVisitDetails } from "@/app/_lib/db/drizzle/queries/visit";
import { parseVisitNote } from "@/app/_lib/visit-note/schema";
import { enrichCodingSuggestions } from "@/app/_lib/visit-note/sign-off";
import { VisitCloseContent } from "@/app/_components/visit/visit-close-content";

interface VisitClosePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitId?: string }>;
}

export default async function VisitClosePage({
  params,
  searchParams,
}: VisitClosePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  if (user.role !== "doctor") {
    redirect("/");
  }

  const { id: patientId } = await params;
  const { visitId } = await searchParams;

  if (!visitId) {
    notFound();
  }

  const visitDetails = await getVisitDetails(visitId);
  if (!visitDetails || visitDetails.patient.id !== patientId) {
    notFound();
  }

  const latestNote = visitDetails.notes[0]?.note;
  const parsedNote = enrichCodingSuggestions(parseVisitNote(latestNote || {}));

  return (
    <VisitCloseContent
      patientId={patientId}
      patientName={visitDetails.patient.fullName}
      visitId={visitId}
      initialNote={parsedNote}
    />
  );
}
