"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getPatientSurgicalHistory,
  updatePatientSurgicalHistory,
  type SurgicalHistoryEntry,
} from "@/app/_lib/db/drizzle/queries/surgical-history";
import { v4 as uuidv4 } from "uuid";

export async function getPatientSurgicalHistoryAction(patientId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can view surgical history"
    );
  }

  try {
    const surgicalHistory = await getPatientSurgicalHistory(patientId);
    return { success: true, surgicalHistory };
  } catch (error) {
    console.error("Error fetching surgical history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch surgical history"
    );
  }
}

export async function addSurgicalHistoryAction(
  patientId: string,
  entry: Omit<SurgicalHistoryEntry, "id" | "createdAt">
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can add surgical history"
    );
  }

  try {
    const existingHistory = await getPatientSurgicalHistory(patientId);

    const newEntry: SurgicalHistoryEntry = {
      id: uuidv4(),
      procedure: entry.procedure,
      date: entry.date,
      laterality: entry.laterality,
      site: entry.site,
      surgeon: entry.surgeon,
      hospital: entry.hospital,
      outcome: entry.outcome,
      complications: entry.complications,
      source: entry.source,
      notes: entry.notes,
      createdAt: new Date().toISOString(),
    };

    const updatedHistory = [...existingHistory, newEntry];
    await updatePatientSurgicalHistory(patientId, updatedHistory);

    revalidatePath(`/patients/${patientId}/surgical-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error adding surgical history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to add surgical history"
    );
  }
}

export async function updateSurgicalHistoryAction(
  patientId: string,
  entryId: string,
  updates: Partial<Omit<SurgicalHistoryEntry, "id" | "createdAt">>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update surgical history"
    );
  }

  try {
    const history = await getPatientSurgicalHistory(patientId);
    const updatedHistory = history.map((entry) =>
      entry.id === entryId ? { ...entry, ...updates } : entry
    );

    await updatePatientSurgicalHistory(patientId, updatedHistory);

    revalidatePath(`/patients/${patientId}/surgical-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating surgical history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update surgical history"
    );
  }
}

export async function deleteSurgicalHistoryAction(
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
      "Unauthorized: Only doctors and nurses can delete surgical history"
    );
  }

  try {
    const history = await getPatientSurgicalHistory(patientId);
    const updatedHistory = history.filter((entry) => entry.id !== entryId);

    await updatePatientSurgicalHistory(patientId, updatedHistory);

    revalidatePath(`/patients/${patientId}/surgical-history`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting surgical history:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to delete surgical history"
    );
  }
}

