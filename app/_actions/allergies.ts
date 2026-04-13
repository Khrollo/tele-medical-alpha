"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getPatientAllergies,
  updatePatientAllergies,
  type Allergy,
} from "@/app/_lib/db/drizzle/queries/allergies";
import { v4 as uuidv4 } from "uuid";

export async function getPatientAllergiesAction(patientId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can view allergies");
  }

  try {
    const allergies = await getPatientAllergies(patientId);
    return { success: true, allergies };
  } catch (error) {
    console.error("Error fetching allergies:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch allergies"
    );
  }
}

export async function addAllergyAction(
  patientId: string,
  allergy: Omit<Allergy, "id" | "createdAt">
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can add allergies");
  }

  try {
    const existingAllergies = await getPatientAllergies(patientId);

    const newAllergy: Allergy = {
      id: uuidv4(),
      name: allergy.name,
      severity: allergy.severity,
      type: allergy.type,
      reactions: allergy.reactions,
      status: allergy.status,
      createdAt: new Date().toISOString(),
    };

    const updatedAllergies = [...existingAllergies, newAllergy];
    await updatePatientAllergies(patientId, updatedAllergies);

    revalidatePath(`/patients/${patientId}/allergies`);
    revalidatePath(`/patients/${patientId}`);
    revalidateTag(`patient:${patientId}`, "max");
    revalidateTag("patients", "max");

    return { success: true };
  } catch (error) {
    console.error("Error adding allergy:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to add allergy"
    );
  }
}

export async function updateAllergyAction(
  patientId: string,
  allergyId: string,
  updates: Partial<Omit<Allergy, "id" | "createdAt">>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update allergies"
    );
  }

  try {
    const allergies = await getPatientAllergies(patientId);
    const updatedAllergies = allergies.map((allergy) =>
      allergy.id === allergyId ? { ...allergy, ...updates } : allergy
    );

    await updatePatientAllergies(patientId, updatedAllergies);

    revalidatePath(`/patients/${patientId}/allergies`);
    revalidatePath(`/patients/${patientId}`);
    revalidateTag(`patient:${patientId}`, "max");
    revalidateTag("patients", "max");

    return { success: true };
  } catch (error) {
    console.error("Error updating allergy:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update allergy"
    );
  }
}

export async function deleteAllergyAction(
  patientId: string,
  allergyId: string
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can delete allergies"
    );
  }

  try {
    const allergies = await getPatientAllergies(patientId);
    const updatedAllergies = allergies.filter(
      (allergy) => allergy.id !== allergyId
    );

    await updatePatientAllergies(patientId, updatedAllergies);

    revalidatePath(`/patients/${patientId}/allergies`);
    revalidatePath(`/patients/${patientId}`);
    revalidateTag(`patient:${patientId}`, "max");
    revalidateTag("patients", "max");

    return { success: true };
  } catch (error) {
    console.error("Error deleting allergy:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete allergy"
    );
  }
}
