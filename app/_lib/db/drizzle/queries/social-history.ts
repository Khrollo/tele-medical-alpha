import { eq } from "drizzle-orm";
import { db } from "../index";
import { patients } from "../schema";

export interface SocialHistory {
  // Substance Use
  tobacco?: {
    status: "Never" | "Former" | "Current";
    amount?: string;
    years?: string;
    quitDate?: string;
  };
  alcohol?: {
    status: "Never" | "Occasional" | "Regular" | "Former";
    frequency?: string;
    amount?: string;
  };
  otherSubstances?: Array<{
    id: string;
    name: string;
    status: string;
    notes?: string;
  }>;

  // Occupation & Living
  occupation?: {
    title?: string;
    description?: string;
    hazards?: string;
  };
  livingSituation?: {
    status: "Stable" | "Unstable" | "Homeless" | "Other";
    description?: string;
    household?: string;
  };

  // Lifestyle
  lifestyle?: {
    activityLevel?: "Sedentary" | "Light" | "Moderate" | "Active" | "Very Active";
    dietQuality?: "Poor" | "Fair" | "Good" | "Excellent";
    exerciseHabits?: string;
    sleepHours?: string;
    sleepQuality?: "Poor" | "Fair" | "Good" | "Excellent";
    stressLevel?: "Low" | "Moderate" | "High" | "Very High";
  };

  // Psychosocial
  psychosocial?: {
    socialSupport?: "Strong" | "Moderate" | "Limited" | "None";
    financialStrain?: "Stable" | "Moderate" | "Significant" | "Crisis";
    transportation?: "Accessible" | "Limited" | "None";
    notes?: string;
  };

  // Sexual Health
  sexualHealth?: {
    status?: string;
    partners?: string;
    contraception?: string;
    stiHistory?: string;
  };

  // Clinician Notes
  clinicianNotes?: string;

  // Metadata
  lastUpdated?: string;
}

/**
 * Get patient social history
 */
export async function getPatientSocialHistory(
  patientId: string
): Promise<SocialHistory | null> {
  const result = await db
    .select({ socialHistory: patients.socialHistory })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!result[0] || !result[0].socialHistory) {
    return null;
  }

  return result[0].socialHistory as SocialHistory;
}

/**
 * Update patient social history
 */
export async function updatePatientSocialHistory(
  patientId: string,
  socialHistory: SocialHistory
) {
  await db
    .update(patients)
    .set({
      socialHistory: socialHistory as unknown,
      updatedAt: new Date(),
    })
    .where(eq(patients.id, patientId));
}

