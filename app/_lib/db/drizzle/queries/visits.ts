import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../index";
import { visits, patients } from "../schema";

/**
 * Get all visits for a specific patient
 * @param patientId - UUID of the patient
 * @returns Array of visits with patient information
 */
export async function getVisitsByPatientId(patientId: string) {
  return unstable_cache(
    async () => {
      const result = await db
    .select()
    .from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(visits.createdAt);

      return result;
    },
    [`visits-patient-${patientId}`],
    {
      tags: [`visits:${patientId}`, `patient:${patientId}`],
      revalidate: 60,
    }
  )();
}

/**
 * Get a single visit by ID with patient information
 * @param visitId - UUID of the visit
 * @returns Visit with patient information, or undefined if not found
 */
export async function getVisitById(visitId: string) {
  return unstable_cache(
    async () => {
      const result = await db
    .select({
      visit: visits,
      patient: patients,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(eq(visits.id, visitId))
    .limit(1);

      return result[0];
    },
    [`visit-${visitId}`],
    {
      tags: [`visit:${visitId}`],
      revalidate: 60,
    }
  )();
}

