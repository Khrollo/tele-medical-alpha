import { db } from "../index";
import { documents } from "../schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";

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

export async function getDocumentByStorageUrl(
  patientId: string,
  storageUrl: string,
  visitId?: string
) {
  const filters = [
    eq(documents.patientId, patientId),
    eq(documents.storageUrl, storageUrl),
    visitId ? eq(documents.visitId, visitId) : isNull(documents.visitId),
  ];

  const result = await db
    .select()
    .from(documents)
    .where(and(...filters))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get documents for a patient (ordered by newest first)
 */
export async function getPatientDocuments(patientId: string) {
  return unstable_cache(
    async () => {
      return await db
    .select()
    .from(documents)
    .where(eq(documents.patientId, patientId))
    .orderBy(desc(documents.uploadedAt));
    },
    [`patient-documents-${patientId}`],
    {
      tags: [`documents:${patientId}`, `patient:${patientId}`],
      revalidate: 60,
    }
  )();
}

/**
 * Get documents for a visit
 */
export async function getVisitDocuments(visitId: string) {
  return unstable_cache(
    async () => {
      return await db
    .select()
    .from(documents)
    .where(eq(documents.visitId, visitId))
    .orderBy(documents.uploadedAt);
    },
    [`visit-documents-${visitId}`],
    {
      tags: [`visit:${visitId}`],
      revalidate: 60,
    }
  )();
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
