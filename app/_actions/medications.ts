"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getPatientMedications,
  updatePatientMedications,
  type Medication,
} from "@/app/_lib/db/drizzle/queries/medications";
import { v4 as uuidv4 } from "uuid";

export async function getPatientMedicationsAction(patientId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can view medications");
  }

  try {
    const medications = await getPatientMedications(patientId);
    return { success: true, medications };
  } catch (error) {
    console.error("Error fetching medications:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch medications"
    );
  }
}

export async function addMedicationAction(
  patientId: string,
  medication: Omit<Medication, "id" | "createdAt">
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can add medications");
  }

  try {
    const existingMedications = await getPatientMedications(patientId);
    
    const newMedication: Medication = {
      id: uuidv4(),
      brandName: medication.brandName,
      genericName: medication.genericName,
      strength: medication.strength,
      form: medication.form,
      dosage: medication.dosage,
      frequency: medication.frequency,
      status: medication.status,
      notes: medication.notes,
      createdAt: new Date().toISOString(),
    };

    const updatedMedications = [...existingMedications, newMedication];
    await updatePatientMedications(patientId, updatedMedications);

    revalidatePath(`/patients/${patientId}/medications`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error adding medication:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to add medication"
    );
  }
}

export async function updateMedicationAction(
  patientId: string,
  medicationId: string,
  updates: Partial<Omit<Medication, "id" | "createdAt">>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can update medications");
  }

  try {
    const medications = await getPatientMedications(patientId);
    const updatedMedications = medications.map((medication) =>
      medication.id === medicationId ? { ...medication, ...updates } : medication
    );

    await updatePatientMedications(patientId, updatedMedications);

    revalidatePath(`/patients/${patientId}/medications`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating medication:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update medication"
    );
  }
}

export async function deleteMedicationAction(patientId: string, medicationId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can delete medications");
  }

  try {
    const medications = await getPatientMedications(patientId);
    const updatedMedications = medications.filter((medication) => medication.id !== medicationId);

    await updatePatientMedications(patientId, updatedMedications);

    revalidatePath(`/patients/${patientId}/medications`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting medication:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete medication"
    );
  }
}

/**
 * Sync medications from visit to patient's currentMedications
 * Merges visit medications with existing patient medications, avoiding duplicates
 */
export async function syncVisitMedicationsToPatientAction(
  patientId: string,
  visitMedications: Array<{
    id?: string;
    brandName?: string;
    genericName?: string;
    strength?: string;
    form?: string;
    dosage?: string;
    frequency?: string;
    status?: "Active" | "Inactive" | "Discontinued";
    notes?: string;
    createdAt?: string;
  }>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can sync medications");
  }

  try {
    if (!visitMedications || visitMedications.length === 0) {
      return { success: true, added: 0, updated: 0 };
    }

    const existingMedications = await getPatientMedications(patientId);
    const updatedMedications = [...existingMedications];

    // Helper function to check if two medications are the same
    const medicationsMatch = (
      med1: Medication,
      med2: {
        brandName?: string;
        genericName?: string;
        strength?: string;
        form?: string;
      }
    ): boolean => {
      const name1 = (med1.brandName || med1.genericName || "").toLowerCase().trim();
      const name2 = ((med2.brandName || med2.genericName) || "").toLowerCase().trim();
      
      if (!name1 || !name2) return false;
      
      // Check if names match (either brand or generic)
      const namesMatch = name1 === name2 || 
        (med1.brandName && med2.brandName && med1.brandName.toLowerCase().trim() === med2.brandName.toLowerCase().trim()) ||
        (med1.genericName && med2.genericName && med1.genericName.toLowerCase().trim() === med2.genericName.toLowerCase().trim());
      
      if (!namesMatch) return false;
      
      // If strength is provided in both, they should match
      if (med1.strength && med2.strength && 
          med1.strength.toLowerCase().trim() !== med2.strength.toLowerCase().trim()) {
        return false;
      }
      
      return true;
    };

    let added = 0;
    let updated = 0;

    for (const visitMed of visitMedications) {
      // Skip medications without at least a brand name or generic name
      if (!visitMed.brandName?.trim() && !visitMed.genericName?.trim()) {
        continue;
      }

      // Check if this medication already exists
      const existingIndex = updatedMedications.findIndex((existing) =>
        medicationsMatch(existing, visitMed)
      );

      if (existingIndex >= 0) {
        // Update existing medication with visit data (visit data takes precedence)
        updatedMedications[existingIndex] = {
          ...updatedMedications[existingIndex],
          brandName: visitMed.brandName || updatedMedications[existingIndex].brandName,
          genericName: visitMed.genericName || updatedMedications[existingIndex].genericName,
          strength: visitMed.strength || updatedMedications[existingIndex].strength,
          form: visitMed.form || updatedMedications[existingIndex].form,
          dosage: visitMed.dosage || updatedMedications[existingIndex].dosage,
          frequency: visitMed.frequency || updatedMedications[existingIndex].frequency,
          status: visitMed.status || updatedMedications[existingIndex].status,
          notes: visitMed.notes || updatedMedications[existingIndex].notes,
        };
        updated++;
      } else {
        // Add new medication
        const newMedication: Medication = {
          id: visitMed.id || uuidv4(),
          brandName: visitMed.brandName,
          genericName: visitMed.genericName,
          strength: visitMed.strength,
          form: visitMed.form,
          dosage: visitMed.dosage,
          frequency: visitMed.frequency,
          status: visitMed.status || "Active",
          notes: visitMed.notes,
          createdAt: visitMed.createdAt || new Date().toISOString(),
        };
        updatedMedications.push(newMedication);
        added++;
      }
    }

    // Update patient medications
    await updatePatientMedications(patientId, updatedMedications);

    revalidatePath(`/patients/${patientId}/medications`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true, added, updated };
  } catch (error) {
    console.error("Error syncing visit medications:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to sync medications"
    );
  }
}

