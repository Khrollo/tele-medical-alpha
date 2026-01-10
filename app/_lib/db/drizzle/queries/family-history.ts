import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface FamilyHistoryEntry {
  id: string;
  relationship: string;
  status: "Living" | "Deceased";
  conditions: string[];
  createdAt?: string;
}

/**
 * Get patient family history
 */
export async function getPatientFamilyHistory(
  patientId: string
): Promise<FamilyHistoryEntry[]> {
  const result = await db
    .select({ familyHistory: patients.familyHistory })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0] || !result[0].familyHistory) {
    return [];
  }

  const familyHistory = result[0].familyHistory as unknown;

  if (Array.isArray(familyHistory)) {
    // If it's an array of objects, return as is
    if (familyHistory.length > 0 && typeof familyHistory[0] === "object") {
      return familyHistory as FamilyHistoryEntry[];
    }
    // If it's an array of strings (old format), convert to new format
    if (familyHistory.length > 0 && typeof familyHistory[0] === "string") {
      return (familyHistory as string[]).map((condition, index) => ({
        id: `legacy-${index}`,
        relationship: "Unknown",
        status: "Living" as const,
        conditions: [condition],
      }));
    }
  }

  return [];
}

/**
 * Update patient family history
 */
export async function updatePatientFamilyHistory(
  patientId: string,
  familyHistory: FamilyHistoryEntry[]
) {
  await db
    .update(patients)
    .set({
      familyHistory: familyHistory as unknown,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

