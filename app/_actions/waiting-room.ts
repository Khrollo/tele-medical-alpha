"use server";

import { db } from "@/app/_lib/db/drizzle/index";
import { notes, patients, visits } from "@/app/_lib/db/drizzle/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";
import { getWorkflowFlagsForPatients } from "@/app/_lib/db/drizzle/queries/patient-workflow";
import { requireUser } from "@/app/_lib/auth/get-current-user";

/**
 * Fetch unassigned patients with their active visit info for the waiting room.
 * Called by the client polling hook to replace direct Supabase PostgREST queries.
 *
 * Auth parity with the initial server-rendered page load: the polling path
 * MUST enforce the same clinician role check as `WaitingRoomPage`. Without
 * this, any caller can scrape the queue + PHI every 3s via the server action.
 * `requireUser` throws on unauthorized / forbidden; we let that propagate so
 * the client hook can back off instead of spinning on a silent failure.
 */
export async function fetchWaitingRoomPatientsAction() {
  await requireUser(["doctor", "nurse"]);
  const unassignedPatients = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      avatarUrl: patients.avatarUrl,
      dob: patients.dob,
      allergies: patients.allergies,
      currentMedications: patients.currentMedications,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(eq(patients.isAssigned, false))
    .orderBy(desc(patients.createdAt));

  const patientIds = unassignedPatients.map((p) => p.id);

  if (patientIds.length === 0) {
    return [];
  }

  const waitingVisits = await db
    .select({
      id: visits.id,
      patientId: visits.patientId,
      priority: visits.priority,
      appointmentType: visits.appointmentType,
      createdAt: visits.createdAt,
      status: visits.status,
      clinicianId: visits.clinicianId,
      twilioRoomName: visits.twilioRoomName,
      patientJoinToken: visits.patientJoinToken,
    })
    .from(visits)
    .where(
      and(
        inArray(visits.patientId, patientIds),
        or(
          eq(visits.status, "Waiting"),
          eq(visits.status, "waiting"),
          eq(visits.status, "In Progress"),
          eq(visits.status, "in_progress")
        )
      )
    )
    .orderBy(desc(visits.createdAt));

  const visitIds = waitingVisits.map((visit) => visit.id);
  const relatedNotes =
    visitIds.length > 0
      ? await db
          .select({
            visitId: notes.visitId,
            note: notes.note,
            createdAt: notes.createdAt,
          })
          .from(notes)
          .where(inArray(notes.visitId, visitIds))
          .orderBy(desc(notes.createdAt))
      : [];

  const chiefComplaintByVisit = new Map<string, string>();
  for (const noteRow of relatedNotes) {
    if (chiefComplaintByVisit.has(noteRow.visitId)) {
      continue;
    }

    const noteData =
      noteRow.note && typeof noteRow.note === "object"
        ? (noteRow.note as { subjective?: { chiefComplaint?: string } })
        : null;
    const chiefComplaint = noteData?.subjective?.chiefComplaint?.trim();
    if (chiefComplaint) {
      chiefComplaintByVisit.set(noteRow.visitId, chiefComplaint);
    }
  }

  const visitMap = new Map<string, (typeof waitingVisits)[0]>();
  for (const visit of waitingVisits) {
    if (!visitMap.has(visit.patientId)) {
      visitMap.set(visit.patientId, visit);
    }
  }

  const workflowFlags = await getWorkflowFlagsForPatients(patientIds);

  return unassignedPatients.map((patient) => {
    const visit = visitMap.get(patient.id);
    return {
      id: patient.id,
      fullName: patient.fullName,
      avatarUrl: patient.avatarUrl,
      dob: patient.dob,
      allergiesCount: Array.isArray(patient.allergies) ? patient.allergies.length : 0,
      medicationsCount: Array.isArray(patient.currentMedications)
        ? patient.currentMedications.length
        : 0,
      createdAt: patient.createdAt.toISOString(),
      workflow: workflowFlags.get(patient.id) ?? null,
      visit: visit
        ? {
            id: visit.id,
            priority: visit.priority,
            appointmentType: visit.appointmentType,
            createdAt: visit.createdAt.toISOString(),
            status: visit.status,
            clinicianId: visit.clinicianId,
            twilioRoomName: visit.twilioRoomName,
            patientJoinToken: visit.patientJoinToken,
            chiefComplaint: chiefComplaintByVisit.get(visit.id) || null,
          }
        : null,
    };
  });
}
