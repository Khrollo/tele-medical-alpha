import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface VaccineHistory {
  id: string;
  vaccineName: string;
  dateAdministered: string; // YYYY-MM-DD
  doseNumber?: string;
  administrationSite?: string;
  route?: string;
  lotNumber?: string;
  manufacturer?: string;
  createdAt?: string;
}

export interface ScheduledVaccine {
  id: string;
  vaccineName: string;
  scheduledDate: string; // YYYY-MM-DD
  doseNumber?: string;
  notes?: string;
  createdAt?: string;
}

export type Vaccine = VaccineHistory | (ScheduledVaccine & { type: "scheduled" });

/**
 * Get patient vaccines (both history and scheduled)
 */
export async function getPatientVaccines(patientId: string): Promise<{
  history: VaccineHistory[];
  scheduled: ScheduledVaccine[];
}> {
  const result = await db
    .select({ vaccines: patients.vaccines })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0] || !result[0].vaccines) {
    return { history: [], scheduled: [] };
  }

  const vaccines = result[0].vaccines as unknown;
  
  if (typeof vaccines === "object" && vaccines !== null && !Array.isArray(vaccines)) {
    const vaccineData = vaccines as { history?: VaccineHistory[]; scheduled?: ScheduledVaccine[] };
    return {
      history: Array.isArray(vaccineData.history) ? vaccineData.history : [],
      scheduled: Array.isArray(vaccineData.scheduled) ? vaccineData.scheduled : [],
    };
  }

  // Handle old format (array of objects)
  if (Array.isArray(vaccines)) {
    // Try to determine if it's history or scheduled based on fields
    const history: VaccineHistory[] = [];
    const scheduled: ScheduledVaccine[] = [];
    
    for (const vaccine of vaccines) {
      if (typeof vaccine === "object" && vaccine !== null) {
        if ("dateAdministered" in vaccine) {
          history.push(vaccine as VaccineHistory);
        } else if ("scheduledDate" in vaccine) {
          scheduled.push(vaccine as ScheduledVaccine);
        }
      }
    }
    
    return { history, scheduled };
  }

  return { history: [], scheduled: [] };
}

/**
 * Update patient vaccines
 */
export async function updatePatientVaccines(
  patientId: string,
  vaccines: { history: VaccineHistory[]; scheduled: ScheduledVaccine[] }
) {
  await db
    .update(patients)
    .set({
      vaccines: vaccines as unknown,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

