import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface PastMedicalHistoryEntry {
  id: string;
  condition: string;
  status: string; // "Active", "Resolved", "Chronic", etc.
  diagnosedDate?: string; // ISO date string
  impact?: string; // "High", "Moderate", "Low", etc.
  icd10?: string; // ICD-10 code
  source?: string; // Source of information
  verified?: boolean;
  verifiedDate?: string; // ISO date string
  verifiedBy?: string; // User ID who verified
  notes?: string;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

export interface PastMedicalHistoryData {
  entries: PastMedicalHistoryEntry[];
  noSignificantPMH: boolean; // Flag to mark patient has no significant past medical history
  lastUpdated?: string; // ISO date string
}

/**
 * Get patient past medical history
 */
export async function getPatientPastMedicalHistory(patientId: string): Promise<PastMedicalHistoryData> {
  const result = await db
    .select({
      pastMedicalHistory: patients.pastMedicalHistory,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0]) {
    return { entries: [], noSignificantPMH: false };
  }

  // Parse past medical history JSONB
  try {
    const pmh = result[0].pastMedicalHistory as unknown;
    if (!pmh) {
      return { entries: [], noSignificantPMH: false };
    }

    // Check if it's the new format with entries array
    if (typeof pmh === 'object' && 'entries' in pmh) {
      const obj = pmh as Record<string, unknown>;
      return {
        entries: Array.isArray(obj.entries) ? obj.entries as PastMedicalHistoryEntry[] : [],
        noSignificantPMH: typeof obj.noSignificantPMH === 'boolean' ? obj.noSignificantPMH : false,
        lastUpdated: typeof obj.lastUpdated === 'string' ? obj.lastUpdated : undefined,
      };
    }

    // Legacy format: array of entries
    if (Array.isArray(pmh)) {
      return { entries: pmh as PastMedicalHistoryEntry[], noSignificantPMH: false };
    }

    return { entries: [], noSignificantPMH: false };
  } catch (error) {
    console.error("Error parsing past medical history:", error);
    return { entries: [], noSignificantPMH: false };
  }
}

/**
 * Update patient past medical history
 */
export async function updatePatientPastMedicalHistory(
  patientId: string,
  data: PastMedicalHistoryData
): Promise<void> {
  await db
    .update(patients)
    .set({
      pastMedicalHistory: data as any,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

