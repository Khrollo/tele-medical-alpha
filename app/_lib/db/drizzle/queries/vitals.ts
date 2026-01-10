import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface VitalEntry {
  id: string;
  date: string; // ISO date string
  bp?: string; // Blood pressure (e.g., "120/80")
  hr?: string; // Heart rate
  temp?: string; // Temperature
  weight?: string; // Weight in lbs
  height?: string; // Height in cm
  spo2?: string; // Oxygen saturation
  rr?: string; // Respiratory rate
  bmi?: string; // BMI (calculated)
  notes?: string;
}

/**
 * Get patient vitals
 */
export async function getPatientVitals(patientId: string): Promise<VitalEntry[]> {
  const result = await db
    .select({
      vitals: patients.vitals,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0] || !result[0].vitals) {
    return [];
  }

  // Parse vitals JSONB - it should be an array of vital entries
  try {
    const vitals = result[0].vitals as unknown;
    if (Array.isArray(vitals)) {
      return vitals as VitalEntry[];
    }
    // If it's a single object, convert to array
    if (vitals && typeof vitals === 'object') {
      return [vitals as VitalEntry];
    }
    return [];
  } catch (error) {
    console.error("Error parsing vitals:", error);
    return [];
  }
}

/**
 * Update patient vitals
 */
export async function updatePatientVitals(
  patientId: string,
  vitals: VitalEntry[]
): Promise<void> {
  await db
    .update(patients)
    .set({
      vitals: vitals as any,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

