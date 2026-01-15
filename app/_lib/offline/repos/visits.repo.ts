import { getOfflineDB, type CachedVisit } from "../db";
import { queueMutation } from "../outbox";

/**
 * Get cached visit from Dexie
 */
export async function getCached(visitId: string): Promise<CachedVisit | null> {
  const db = getOfflineDB();
  const cached = await db.visits.get(visitId);
  return cached || null;
}

/**
 * Get all cached visits for a patient
 */
export async function getCachedByPatient(patientId: string): Promise<CachedVisit[]> {
  const db = getOfflineDB();
  return db.visits
    .where("patientId")
    .equals(patientId)
    .sortBy("createdAt");
}

/**
 * Upsert visit from server response
 */
export async function upsertFromServer(visit: {
  id: string;
  patientId: string;
  [key: string]: unknown;
}): Promise<void> {
  const db = getOfflineDB();
  const now = Date.now();
  
  await db.visits.put({
    id: visit.id,
    patientId: visit.patientId,
    data: visit,
    createdAt: (visit.createdAt as Date)?.getTime() || now,
    cachedAt: now,
  });
}

/**
 * List cached visits for a patient with optional filters
 */
export async function listCached(
  patientId: string,
  filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CachedVisit[]> {
  const db = getOfflineDB();
  let query = db.visits
    .where("patientId")
    .equals(patientId)
    .reverse()
    .sortBy("createdAt");
  
  let visits = await query;
  
  if (filters?.status) {
    visits = visits.filter((v) => {
      const data = v.data as { status?: string };
      return data.status === filters.status;
    });
  }
  
  if (filters?.offset) {
    visits = visits.slice(filters.offset);
  }
  
  if (filters?.limit) {
    visits = visits.slice(0, filters.limit);
  }
  
  return visits;
}

/**
 * Apply optimistic update to cached visit
 */
export async function applyOptimistic(
  visitId: string,
  updates: Partial<Record<string, unknown>>
): Promise<void> {
  const db = getOfflineDB();
  const existing = await db.visits.get(visitId);
  
  if (existing) {
    const currentData = existing.data as Record<string, unknown>;
    const updatedData = { ...currentData, ...updates };
    
    await db.visits.update(visitId, {
      data: updatedData,
      cachedAt: Date.now(),
    });
  } else {
    // Create new entry if doesn't exist (requires patientId)
    if (updates.patientId) {
      await db.visits.add({
        id: visitId,
        patientId: updates.patientId as string,
        data: updates,
        createdAt: Date.now(),
        cachedAt: Date.now(),
      });
    }
  }
}

/**
 * Queue a visit mutation to outbox
 */
export async function queueVisitMutation(
  action: string,
  payload: Record<string, unknown>
): Promise<string> {
  const visitId = payload.visitId as string || "";
  return queueMutation({
    type: action,
    endpoint: `/api/visits/${visitId}`,
    method: "POST",
    payloadJson: JSON.stringify(payload),
  });
}
