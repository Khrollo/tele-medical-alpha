import { db } from "../index";
import { documents } from "../schema";
import { eq, desc } from "drizzle-orm";

export interface CreateDocumentParams {
  patientId: string;
  visitId?: string;
  filename: string;
  mimeType: string;
  size: string;
  storageUrl: string;
  uploadedBy?: string;
}

/**
 * Create a new document record
 */
export async function createDocument(params: CreateDocumentParams) {
  const result = await db
    .insert(documents)
    .values({
      patientId: params.patientId,
      visitId: params.visitId || null,
      filename: params.filename,
      mimeType: params.mimeType,
      size: params.size,
      storageUrl: params.storageUrl,
      uploadedBy: params.uploadedBy || null,
    })
    .returning();

  return result[0];
}

/**
 * Get documents for a patient (ordered by newest first)
 */
export async function getPatientDocuments(patientId: string) {
  return await db
    .select()
    .from(documents)
    .where(eq(documents.patientId, patientId))
    .orderBy(desc(documents.uploadedAt));
}

/**
 * Get documents for a visit
 */
export async function getVisitDocuments(visitId: string) {
  return await db
    .select()
    .from(documents)
    .where(eq(documents.visitId, visitId))
    .orderBy(documents.uploadedAt);
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string) {
  const result = await db
    .delete(documents)
    .where(eq(documents.id, documentId))
    .returning();

  return result[0];
}
