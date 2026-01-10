import { redirect, notFound } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getVisitById } from "@/app/_lib/db/drizzle/queries/visit";
import { getPatientBasics } from "@/app/_lib/db/drizzle/queries/patient";
import { CallPageContent } from "./call-page-content";

export default async function CallPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;

  // Check authentication
  const session = await getServerSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Only doctors and nurses can access
  if (session.role !== "doctor" && session.role !== "nurse") {
    redirect("/sign-in");
  }

  // Get visit
  const visit = await getVisitById(visitId);
  if (!visit) {
    notFound();
  }

  // Verify it's a virtual appointment
  if (visit.appointmentType?.toLowerCase() !== "virtual") {
    redirect(`/patients/${visit.patientId}/new-visit?visitId=${visitId}`);
  }

  // Verify access:
  // - Doctors must be assigned to the visit (clinicianId matches)
  // - Nurses can join if visit is virtual, has a clinician assigned, and has a join token
  if (session.role === "doctor") {
    if (visit.clinicianId !== session.id) {
      redirect("/waiting-room");
    }
  } else if (session.role === "nurse") {
    // Nurses can join if visit is virtual, has clinician assigned, and has join token
    if (!visit.clinicianId || !visit.patientJoinToken) {
      redirect(`/patients/${visit.patientId}`);
    }
  }

  // Get patient basics
  const patientBasics = await getPatientBasics(visit.patientId);
  if (!patientBasics) {
    notFound();
  }

  return (
    <CallPageContent
      visitId={visitId}
      patientId={visit.patientId}
      patientBasics={patientBasics}
      roomName={visit.twilioRoomName || ""}
      userId={session.id}
      userRole={session.role}
    />
  );
}

