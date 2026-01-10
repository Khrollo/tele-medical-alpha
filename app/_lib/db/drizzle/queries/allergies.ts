import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface Allergy {
  id: string;
  name: string;
  severity: "Mild" | "Moderate" | "Severe";
  type?: string;
  reactions?: string;
  status: "Active" | "Inactive" | "Resolved";
  createdAt?: string;
}

/**
 * Get patient allergies
 */
export async function getPatientAllergies(patientId: string): Promise<Allergy[]> {
  const result = await db
    .select({ allergies: patients.allergies })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0] || !result[0].allergies) {
    return [];
  }

  // Handle both old format (array of strings) and new format (array of objects)
  const allergies = result[0].allergies as unknown;
  
  if (Array.isArray(allergies)) {
    // If it's an array of strings (old format), convert to new format
    if (allergies.length > 0 && typeof allergies[0] === "string") {
      return (allergies as string[]).map((name, index) => ({
        id: `legacy-${index}`,
        name,
        severity: "Moderate" as const,
        status: "Active" as const,
      }));
    }
    // If it's already an array of objects, return as is
    return allergies as Allergy[];
  }

  return [];
}

/**
 * Update patient allergies
 */
export async function updatePatientAllergies(
  patientId: string,
  allergies: Allergy[]
) {
  await db
    .update(patients)
    .set({
      allergies: allergies as unknown,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

