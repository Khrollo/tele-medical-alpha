import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface Medication {
  id: string;
  brandName?: string;
  genericName?: string;
  strength?: string;
  form?: string;
  dosage?: string;
  frequency?: string;
  status: "Active" | "Inactive" | "Discontinued";
  notes?: string;
  createdAt?: string;
}

/**
 * Get patient medications
 */
export async function getPatientMedications(patientId: string): Promise<Medication[]> {
  const result = await db
    .select({ currentMedications: patients.currentMedications })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0] || !result[0].currentMedications) {
    return [];
  }

  // Handle both old format (array of strings) and new format (array of objects)
  const medications = result[0].currentMedications as unknown;
  
  if (Array.isArray(medications)) {
    // If it's an array of strings (old format), convert to new format
    if (medications.length > 0 && typeof medications[0] === "string") {
      return (medications as string[]).map((name, index) => ({
        id: `legacy-${index}`,
        brandName: name,
        status: "Active" as const,
      }));
    }
    // If it's already an array of objects, return as is
    return medications as Medication[];
  }

  return [];
}

/**
 * Update patient medications
 */
export async function updatePatientMedications(
  patientId: string,
  medications: Medication[]
) {
  await db
    .update(patients)
    .set({
      currentMedications: medications as unknown,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

