import { eq, desc } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../index";
import { patients, visits } from "../schema";

export interface PatientBasics {
  id: string;
  fullName: string;
  dob: string | null;
  mrn?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sexAtBirth: string | null;
  genderIdentity: string | null;
  primaryLanguage: string | null;
  preferredCommMethod: string | null;
  emergencyContact: unknown;
  allergies: unknown;
  currentMedications: unknown;
  vitals: unknown;
  vaccines: unknown;
  familyHistory: unknown;
  socialHistory: unknown;
  pastMedicalHistory: unknown;
  surgicalHistory: unknown;
  recentVisits?: Array<{
    id: string;
    status: string | null;
    createdAt: Date;
    notesStatus: string | null;
    appointmentType: string | null;
  }>;
}

/**
 * Get patient basics for visit form context
 */
export async function getPatientBasics(patientId: string): Promise<PatientBasics | null> {
  return unstable_cache(
    async () => {
      const result = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dob: patients.dob,
      phone: patients.phone,
      email: patients.email,
      address: patients.address,
      sexAtBirth: patients.sexAtBirth,
      genderIdentity: patients.genderIdentity,
      primaryLanguage: patients.primaryLanguage,
      preferredCommMethod: patients.preferredCommMethod,
      emergencyContact: patients.emergencyContact,
      allergies: patients.allergies,
      currentMedications: patients.currentMedications,
      vitals: patients.vitals,
      vaccines: patients.vaccines,
      familyHistory: patients.familyHistory,
      socialHistory: patients.socialHistory,
      pastMedicalHistory: patients.pastMedicalHistory,
      surgicalHistory: patients.surgicalHistory,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  
  if (!result[0]) {
    return null;
  }
  
  // Get recent visits (last 10)
  const recentVisitsResult = await db
    .select({
      id: visits.id,
      status: visits.status,
      createdAt: visits.createdAt,
      notesStatus: visits.notesStatus,
      appointmentType: visits.appointmentType,
    })
    .from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.createdAt))
    .limit(10);
  
      return {
        ...result[0],
        recentVisits: recentVisitsResult,
      };
    },
    [`patient-basics-${patientId}`],
    {
      tags: [`patient:${patientId}`, "patients"],
      revalidate: 60,
    }
  )();
}

