"use server";

import { getServerSession } from "@/app/_lib/supabase/server";
import { redirect } from "next/navigation";
import { getPatientVitals, updatePatientVitals, type VitalEntry } from "@/app/_lib/db/drizzle/queries/vitals";
import { v4 as uuidv4 } from "uuid";

/**
 * Get patient vitals
 */
export async function getPatientVitalsAction(patientId: string): Promise<VitalEntry[]> {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  return await getPatientVitals(patientId);
}

/**
 * Add a new vital entry
 */
export async function addVitalAction(
  patientId: string,
  vital: Omit<VitalEntry, "id">
): Promise<void> {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existingVitals = await getPatientVitals(patientId);
  const newVital: VitalEntry = {
    id: uuidv4(),
    ...vital,
  };

  // Calculate BMI if weight and height are provided
  if (newVital.weight && newVital.height) {
    const weightKg = parseFloat(newVital.weight) * 0.453592; // Convert lbs to kg
    const heightM = parseFloat(newVital.height) / 100; // Convert cm to m
    if (heightM > 0) {
      const bmi = (weightKg / (heightM * heightM)).toFixed(1);
      newVital.bmi = bmi;
    }
  }

  const updatedVitals = [...existingVitals, newVital].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  await updatePatientVitals(patientId, updatedVitals);
}

/**
 * Update a vital entry
 */
export async function updateVitalAction(
  patientId: string,
  vitalId: string,
  vital: Partial<Omit<VitalEntry, "id" | "date">>
): Promise<void> {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existingVitals = await getPatientVitals(patientId);
  const updatedVitals = existingVitals.map((v) => {
    if (v.id === vitalId) {
      const updated = { ...v, ...vital };
      
      // Recalculate BMI if weight or height changed
      if (updated.weight && updated.height) {
        const weightKg = parseFloat(updated.weight) * 0.453592;
        const heightM = parseFloat(updated.height) / 100;
        if (heightM > 0) {
          const bmi = (weightKg / (heightM * heightM)).toFixed(1);
          updated.bmi = bmi;
        }
      }
      
      return updated;
    }
    return v;
  });

  await updatePatientVitals(patientId, updatedVitals);
}

/**
 * Delete a vital entry
 */
export async function deleteVitalAction(
  patientId: string,
  vitalId: string
): Promise<void> {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized");
  }

  const existingVitals = await getPatientVitals(patientId);
  const updatedVitals = existingVitals.filter((v) => v.id !== vitalId);

  await updatePatientVitals(patientId, updatedVitals);
}

