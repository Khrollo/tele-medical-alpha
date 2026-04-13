"use server";

import { db } from "@/app/_lib/db/drizzle/index";
import { patients, visits } from "@/app/_lib/db/drizzle/schema";
import { eq, and, or, inArray, desc } from "drizzle-orm";

/**
 * Fetch unassigned patients with their active visit info for the waiting room.
 * Called by the client polling hook to replace direct Supabase PostgREST queries.
 */
export async function fetchWaitingRoomPatientsAction() {
  const unassignedPatients = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
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

  const visitMap = new Map<string, (typeof waitingVisits)[0]>();
  for (const visit of waitingVisits) {
    if (!visitMap.has(visit.patientId)) {
      visitMap.set(visit.patientId, visit);
    }
  }

  return unassignedPatients.map((patient) => {
    const visit = visitMap.get(patient.id);
    return {
      id: patient.id,
      fullName: patient.fullName,
      createdAt: patient.createdAt.toISOString(),
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
          }
        : null,
    };
  });
}
