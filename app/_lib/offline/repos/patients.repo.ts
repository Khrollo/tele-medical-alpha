import { getOfflineDB, type CachedPatient } from "../db";
import { queueMutation } from "../outbox";
import { v4 as uuidv4 } from "uuid";

/**
 * Get cached patient from Dexie
 */
export async function getCached(patientId: string): Promise<CachedPatient | null> {
  const db = getOfflineDB();
  const cached = await db.patients.get(patientId);
  return cached || null;
}

/**
 * Upsert patient from server response
 */
export async function upsertFromServer(patient: {
  id: string;
  [key: string]: unknown;
}): Promise<void> {
  const db = getOfflineDB();
  const now = Date.now();
  
  await db.patients.put({
    id: patient.id,
    data: patient,
    updatedAt: (patient.updatedAt as Date)?.getTime() || now,
    cachedAt: now,
  });
}

/**
 * List cached patients
 */
export async function listCached(filters?: {
  limit?: number;
  offset?: number;
}): Promise<CachedPatient[]> {
  const db = getOfflineDB();
  let query = db.patients.orderBy("updatedAt").reverse();
  
  if (filters?.offset) {
    query = query.offset(filters.offset);
  }
  
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  
  return query.toArray();
}

/**
 * Apply optimistic update to cached patient
 */
export async function applyOptimistic(
  patientId: string,
  updates: Partial<Record<string, unknown>>
): Promise<void> {
  const db = getOfflineDB();
  const existing = await db.patients.get(patientId);
  
  if (existing) {
    const currentData = existing.data as Record<string, unknown>;
    const updatedData = { ...currentData, ...updates };
    
    await db.patients.update(patientId, {
      data: updatedData,
      cachedAt: Date.now(),
    });
  } else {
    // Create new entry if doesn't exist
    await db.patients.add({
      id: patientId,
      data: updates,
      updatedAt: Date.now(),
      cachedAt: Date.now(),
    });
  }
}

/**
 * Queue a patient mutation to outbox
 */
export async function queuePatientMutation(
  action: string,
  payload: Record<string, unknown>
): Promise<string> {
  return queueMutation({
    type: action,
    endpoint: `/api/patients/${payload.patientId || ""}`,
    method: "POST",
    payloadJson: JSON.stringify(payload),
  });
}
