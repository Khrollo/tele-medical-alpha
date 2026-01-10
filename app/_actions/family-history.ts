"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getPatientFamilyHistory,
  updatePatientFamilyHistory,
  type FamilyHistoryEntry,
} from "@/app/_lib/db/drizzle/queries/family-history";
import { v4 as uuidv4 } from "uuid";

export async function getPatientFamilyHistoryAction(patientId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can view family history"
    );
  }

  try {
    const familyHistory = await getPatientFamilyHistory(patientId);
    return { success: true, familyHistory };
  } catch (error) {
    console.error("Error fetching family history:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch family history"
    );
  }
}

export async function addFamilyHistoryAction(
  patientId: string,
  entry: Omit<FamilyHistoryEntry, "id" | "createdAt">
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can add family history"
    );
  }

  try {
    const existingHistory = await getPatientFamilyHistory(patientId);

    const newEntry: FamilyHistoryEntry = {
      id: uuidv4(),
      relationship: entry.relationship,
      status: entry.status,
      conditions: entry.conditions,
      createdAt: new Date().toISOString(),
    };

    const updatedHistory = [...existingHistory, newEntry];
    await updatePatientFamilyHistory(patientId, updatedHistory);

    revalidatePath(`/patients/${patientId}/family-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error adding family history:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to add family history"
    );
  }
}

export async function updateFamilyHistoryAction(
  patientId: string,
  entryId: string,
  updates: Partial<Omit<FamilyHistoryEntry, "id" | "createdAt">>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update family history"
    );
  }

  try {
    const history = await getPatientFamilyHistory(patientId);
    const updatedHistory = history.map((entry) =>
      entry.id === entryId ? { ...entry, ...updates } : entry
    );

    await updatePatientFamilyHistory(patientId, updatedHistory);

    revalidatePath(`/patients/${patientId}/family-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating family history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update family history"
    );
  }
}

export async function deleteFamilyHistoryAction(
  patientId: string,
  entryId: string
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can delete family history"
    );
  }

  try {
    const history = await getPatientFamilyHistory(patientId);
    const updatedHistory = history.filter((entry) => entry.id !== entryId);

    await updatePatientFamilyHistory(patientId, updatedHistory);

    revalidatePath(`/patients/${patientId}/family-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting family history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to delete family history"
    );
  }
}

