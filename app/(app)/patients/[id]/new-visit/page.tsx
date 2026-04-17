import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/app/_lib/auth/get-current-user";
import { getPatientBasics } from "@/app/_lib/db/drizzle/queries/patient";
import { getVisitCreatedByRole, getVisitDetails } from "@/app/_lib/db/drizzle/queries/visit";
import { getRecentVisitHistoryPreview } from "@/app/_lib/db/drizzle/queries/visit-history";
import { NewVisitForm } from "@/app/_components/visit/new-visit-form";

interface NewVisitPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitId?: string }>;
}

export default async function NewVisitPage({
  params,
  searchParams,
}: NewVisitPageProps) {
  const { id: patientId } = await params;
  const { visitId } = await searchParams;

  // Check authentication and role
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses
  if (user.role !== "doctor" && user.role !== "nurse") {
    redirect("/");
  }

  // Get patient basics
  const patientBasics = await getPatientBasics(patientId);

  if (!patientBasics) {
    notFound();
  }

  const previousVisits = (await getRecentVisitHistoryPreview(patientId, 6)).filter(
    (visit) => visit.id !== visitId
  );

  // If visitId is provided, load existing visit data for editing
  let existingVisitData = null;
  let visitAppointmentType: string | null = null;
  let visitTwilioRoomName: string | null = null;
  let visitCreatedByRole: "doctor" | "nurse" | null = null;
  if (visitId) {
    const visitDetails = await getVisitDetails(visitId);
    if (visitDetails) {
      if (visitDetails.patient.id !== patientId) {
        notFound();
      }
      if (visitDetails.notes[0]) {
        existingVisitData = visitDetails.notes[0].note;
      }
      visitAppointmentType = visitDetails.visit.appointmentType;
      visitTwilioRoomName = visitDetails.visit.twilioRoomName;
      visitCreatedByRole = await getVisitCreatedByRole(visitId);
    } else {
      notFound();
    }
  }

  return (
    <NewVisitForm
      patientId={patientId}
      patientBasics={patientBasics}
      userId={user.id}
      userRole={user.role}
      existingVisitId={visitId || undefined}
      existingVisitData={existingVisitData || undefined}
      visitAppointmentType={visitAppointmentType ?? undefined}
      visitTwilioRoomName={visitTwilioRoomName ?? undefined}
      visitCreatedByRole={visitCreatedByRole}
      previousVisits={previousVisits}
    />
  );
}

