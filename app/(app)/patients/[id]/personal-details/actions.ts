"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { updatePatientPersonalDetails as updatePatient } from "@/app/_lib/db/drizzle/queries/patient-personal-details";

export interface UpdatePatientPersonalDetailsPayload {
  fullName: string;
  dob: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sexAtBirth: string | null;
  genderIdentity: string | null;
  primaryLanguage: string | null;
  preferredCommMethod: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
}

export async function updatePatientPersonalDetails(
  patientId: string,
  payload: UpdatePatientPersonalDetailsPayload
) {
  // Check authentication and role
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update patient details"
    );
  }

  try {
    // Update patient in database
    await updatePatient(patientId, payload);

    // Revalidate the patient personal details page
    revalidatePath(`/patients/${patientId}/personal-details`);

    return { success: true };
  } catch (error) {
    console.error("Error updating patient personal details:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update patient personal details"
    );
  }
}
