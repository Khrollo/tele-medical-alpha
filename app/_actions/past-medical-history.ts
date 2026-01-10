"use server";

import { getServerSession } from "@/app/_lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getPatientPastMedicalHistory,
  updatePatientPastMedicalHistory,
  type PastMedicalHistoryEntry,
  type PastMedicalHistoryData,
} from "@/app/_lib/db/drizzle/queries/past-medical-history";
import { v4 as uuidv4 } from "uuid";

/**
 * Get patient past medical history
 */
export async function getPatientPastMedicalHistoryAction(
  patientId: string
): Promise<PastMedicalHistoryData> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  return await getPatientPastMedicalHistory(patientId);
}

/**
 * Add a new past medical history entry
 */
export async function addPastMedicalHistoryEntryAction(
  patientId: string,
  entry: Omit<PastMedicalHistoryEntry, "id" | "createdAt" | "updatedAt">
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existing = await getPatientPastMedicalHistory(patientId);
  const newEntry: PastMedicalHistoryEntry = {
    id: uuidv4(),
    ...entry,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedData: PastMedicalHistoryData = {
    ...existing,
    entries: [...existing.entries, newEntry],
    lastUpdated: new Date().toISOString(),
    noSignificantPMH: false, // Reset if adding entry
  };

  await updatePatientPastMedicalHistory(patientId, updatedData);
}

/**
 * Update a past medical history entry
 */
export async function updatePastMedicalHistoryEntryAction(
  patientId: string,
  entryId: string,
  entry: Partial<Omit<PastMedicalHistoryEntry, "id" | "createdAt">>
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existing = await getPatientPastMedicalHistory(patientId);
  const updatedEntries = existing.entries.map((e) => {
    if (e.id === entryId) {
      return {
        ...e,
        ...entry,
        updatedAt: new Date().toISOString(),
      };
    }
    return e;
  });

  const updatedData: PastMedicalHistoryData = {
    ...existing,
    entries: updatedEntries,
    lastUpdated: new Date().toISOString(),
  };

  await updatePatientPastMedicalHistory(patientId, updatedData);
}

/**
 * Delete a past medical history entry
 */
export async function deletePastMedicalHistoryEntryAction(
  patientId: string,
  entryId: string
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existing = await getPatientPastMedicalHistory(patientId);
  const updatedEntries = existing.entries.filter((e) => e.id !== entryId);

  const updatedData: PastMedicalHistoryData = {
    ...existing,
    entries: updatedEntries,
    lastUpdated: new Date().toISOString(),
  };

  await updatePatientPastMedicalHistory(patientId, updatedData);
}

/**
 * Set no significant past medical history flag
 */
export async function setNoSignificantPMHAction(
  patientId: string,
  noSignificantPMH: boolean
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existing = await getPatientPastMedicalHistory(patientId);
  const updatedData: PastMedicalHistoryData = {
    ...existing,
    noSignificantPMH,
    lastUpdated: new Date().toISOString(),
  };

  await updatePatientPastMedicalHistory(patientId, updatedData);
}

/**
 * Verify a past medical history entry
 */
export async function verifyPastMedicalHistoryEntryAction(
  patientId: string,
  entryId: string
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existing = await getPatientPastMedicalHistory(patientId);
  const updatedEntries = existing.entries.map((e) => {
    if (e.id === entryId) {
      return {
        ...e,
        verified: true,
        verifiedDate: new Date().toISOString(),
        verifiedBy: session.id,
        updatedAt: new Date().toISOString(),
      };
    }
    return e;
  });

  const updatedData: PastMedicalHistoryData = {
    ...existing,
    entries: updatedEntries,
    lastUpdated: new Date().toISOString(),
  };

  await updatePatientPastMedicalHistory(patientId, updatedData);
}

/**
 * Verify all past medical history entries
 */
export async function verifyAllPastMedicalHistoryEntriesAction(
  patientId: string
): Promise<void> {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existing = await getPatientPastMedicalHistory(patientId);
  const now = new Date().toISOString();
  const updatedEntries = existing.entries.map((e) => ({
    ...e,
    verified: true,
    verifiedDate: e.verifiedDate || now,
    verifiedBy: e.verifiedBy || session.id,
    updatedAt: now,
  }));

  const updatedData: PastMedicalHistoryData = {
    ...existing,
    entries: updatedEntries,
    lastUpdated: now,
  };

  await updatePatientPastMedicalHistory(patientId, updatedData);
}

