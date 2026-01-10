"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getPatientSocialHistory,
  updatePatientSocialHistory,
  type SocialHistory,
} from "@/app/_lib/db/drizzle/queries/social-history";

export async function getPatientSocialHistoryAction(patientId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can view social history"
    );
  }

  try {
    const socialHistory = await getPatientSocialHistory(patientId);
    return { success: true, socialHistory };
  } catch (error) {
    console.error("Error fetching social history:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch social history"
    );
  }
}

export async function updateSocialHistoryAction(
  patientId: string,
  updates: Partial<SocialHistory>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update social history"
    );
  }

  try {
    const existing = (await getPatientSocialHistory(patientId)) || {};
    const updated: SocialHistory = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    await updatePatientSocialHistory(patientId, updated);

    revalidatePath(`/patients/${patientId}/social-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating social history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update social history"
    );
  }
}

