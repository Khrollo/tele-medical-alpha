"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getPatientVaccines,
  updatePatientVaccines,
  type VaccineHistory,
  type ScheduledVaccine,
} from "@/app/_lib/db/drizzle/queries/vaccines";
import { v4 as uuidv4 } from "uuid";

export async function getPatientVaccinesAction(patientId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can view vaccines");
  }

  try {
    const vaccines = await getPatientVaccines(patientId);
    return { success: true, vaccines };
  } catch (error) {
    console.error("Error fetching vaccines:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch vaccines"
    );
  }
}

export async function addVaccineHistoryAction(
  patientId: string,
  vaccine: Omit<VaccineHistory, "id" | "createdAt">
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can add vaccine history");
  }

  try {
    const { history, scheduled } = await getPatientVaccines(patientId);
    
    const newVaccine: VaccineHistory = {
      id: uuidv4(),
      vaccineName: vaccine.vaccineName,
      dateAdministered: vaccine.dateAdministered,
      doseNumber: vaccine.doseNumber,
      administrationSite: vaccine.administrationSite,
      route: vaccine.route,
      lotNumber: vaccine.lotNumber,
      manufacturer: vaccine.manufacturer,
      createdAt: new Date().toISOString(),
    };

    const updatedVaccines = {
      history: [...history, newVaccine],
      scheduled,
    };

    await updatePatientVaccines(patientId, updatedVaccines);

    revalidatePath(`/patients/${patientId}/vaccines`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error adding vaccine history:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to add vaccine history"
    );
  }
}

export async function scheduleVaccineAction(
  patientId: string,
  vaccine: Omit<ScheduledVaccine, "id" | "createdAt">
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can schedule vaccines");
  }

  try {
    const { history, scheduled } = await getPatientVaccines(patientId);
    
    const newScheduled: ScheduledVaccine = {
      id: uuidv4(),
      vaccineName: vaccine.vaccineName,
      scheduledDate: vaccine.scheduledDate,
      doseNumber: vaccine.doseNumber,
      notes: vaccine.notes,
      createdAt: new Date().toISOString(),
    };

    const updatedVaccines = {
      history,
      scheduled: [...scheduled, newScheduled],
    };

    await updatePatientVaccines(patientId, updatedVaccines);

    revalidatePath(`/patients/${patientId}/vaccines`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error scheduling vaccine:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to schedule vaccine"
    );
  }
}

export async function updateVaccineHistoryAction(
  patientId: string,
  vaccineId: string,
  updates: Partial<Omit<VaccineHistory, "id" | "createdAt">>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can update vaccine history");
  }

  try {
    const { history, scheduled } = await getPatientVaccines(patientId);
    const updatedHistory = history.map((vaccine) =>
      vaccine.id === vaccineId ? { ...vaccine, ...updates } : vaccine
    );

    await updatePatientVaccines(patientId, { history: updatedHistory, scheduled });

    revalidatePath(`/patients/${patientId}/vaccines`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating vaccine history:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update vaccine history"
    );
  }
}

export async function updateScheduledVaccineAction(
  patientId: string,
  vaccineId: string,
  updates: Partial<Omit<ScheduledVaccine, "id" | "createdAt">>
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can update scheduled vaccines");
  }

  try {
    const { history, scheduled } = await getPatientVaccines(patientId);
    const updatedScheduled = scheduled.map((vaccine) =>
      vaccine.id === vaccineId ? { ...vaccine, ...updates } : vaccine
    );

    await updatePatientVaccines(patientId, { history, scheduled: updatedScheduled });

    revalidatePath(`/patients/${patientId}/vaccines`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating scheduled vaccine:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to update scheduled vaccine"
    );
  }
}

export async function deleteVaccineHistoryAction(patientId: string, vaccineId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can delete vaccine history");
  }

  try {
    const { history, scheduled } = await getPatientVaccines(patientId);
    const updatedHistory = history.filter((vaccine) => vaccine.id !== vaccineId);

    await updatePatientVaccines(patientId, { history: updatedHistory, scheduled });

    revalidatePath(`/patients/${patientId}/vaccines`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting vaccine history:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete vaccine history"
    );
  }
}

export async function deleteScheduledVaccineAction(patientId: string, vaccineId: string) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error("Unauthorized: Only doctors and nurses can delete scheduled vaccines");
  }

  try {
    const { history, scheduled } = await getPatientVaccines(patientId);
    const updatedScheduled = scheduled.filter((vaccine) => vaccine.id !== vaccineId);

    await updatePatientVaccines(patientId, { history, scheduled: updatedScheduled });

    revalidatePath(`/patients/${patientId}/vaccines`);
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting scheduled vaccine:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete scheduled vaccine"
    );
  }
}

