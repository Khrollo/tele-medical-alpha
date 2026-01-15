import { getOfflineDB, type CachedDocument } from "../db";
import { queueMutation } from "../outbox";

/**
 * Get cached document from Dexie
 */
export async function getCached(documentId: string): Promise<CachedDocument | null> {
  const db = getOfflineDB();
  const cached = await db.documents.get(documentId);
  return cached || null;
}

/**
 * Get all cached documents for a patient
 */
export async function getCachedByPatient(patientId: string): Promise<CachedDocument[]> {
  const db = getOfflineDB();
  return db.documents
    .where("patientId")
    .equals(patientId)
    .reverse()
    .sortBy("uploadedAt");
}

/**
 * Upsert document from server response
 */
export async function upsertFromServer(document: {
  id: string;
  patientId: string;
  visitId?: string | null;
  [key: string]: unknown;
}): Promise<void> {
  const db = getOfflineDB();
  const now = Date.now();
  
  await db.documents.put({
    id: document.id,
    patientId: document.patientId,
    visitId: document.visitId || null,
    data: document,
    uploadedAt: (document.uploadedAt as Date)?.getTime() || now,
    cachedAt: now,
  });
}

/**
 * List cached documents for a patient/visit
 */
export async function listCached(
  patientId: string,
  visitId?: string
): Promise<CachedDocument[]> {
  const db = getOfflineDB();
  
  if (visitId) {
    return db.documents
      .where("visitId")
      .equals(visitId)
      .sortBy("uploadedAt");
  }
  
  return db.documents
    .where("patientId")
    .equals(patientId)
    .reverse()
    .sortBy("uploadedAt");
}

/**
 * Queue a document mutation to outbox
 */
export async function queueDocumentMutation(
  action: string,
  payload: Record<string, unknown>,
  fileId?: string
): Promise<string> {
  const documentId = payload.documentId as string || "";
  return queueMutation({
    type: action,
    endpoint: `/api/upload/document`,
    method: "POST",
    payloadJson: JSON.stringify(payload),
    fileIds: fileId ? [fileId] : undefined,
  });
}
