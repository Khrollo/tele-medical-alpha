import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface SurgicalHistoryEntry {
  id: string;
  procedure: string;
  date?: string; // YYYY or YYYY-MM-DD
  laterality?: "Left" | "Right" | "Bilateral" | "N/A";
  site?: string;
  surgeon?: string;
  hospital?: string;
  outcome?: string;
  complications?: string;
  source: "Patient Reported" | "Medical Records" | "Other";
  notes?: string;
  createdAt?: string;
}

/**
 * Get patient surgical history
 * Note: We'll need to add a surgicalHistory JSONB field to the patients table
 * For now, we'll use a placeholder that returns empty array
 */
export async function getPatientSurgicalHistory(
  patientId: string
): Promise<SurgicalHistoryEntry[]> {
  const result = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0]) {
    return [];
  }

  // TODO: Add surgicalHistory JSONB field to patients table schema
  // For now, we'll check if there's a surgicalHistory field
  const patient = result[0] as any;
  const surgicalHistory = patient.surgicalHistory as unknown;

  if (Array.isArray(surgicalHistory)) {
    return surgicalHistory as SurgicalHistoryEntry[];
  }

  return [];
}

/**
 * Update patient surgical history
 * Note: Requires surgicalHistory JSONB field in patients table
 */
export async function updatePatientSurgicalHistory(
  patientId: string,
  surgicalHistory: SurgicalHistoryEntry[]
) {
  // TODO: Update schema to include surgicalHistory field
  // For now, using a direct update that will work once the field is added
  await db
    .update(patients)
    .set({
      // @ts-ignore - surgicalHistory field needs to be added to schema
      surgicalHistory: surgicalHistory as unknown,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

