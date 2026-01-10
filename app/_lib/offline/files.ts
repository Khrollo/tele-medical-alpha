import { getOfflineDB, type StoredFile } from "./db";
import { v4 as uuidv4 } from "uuid";

/**
 * Store a file for later upload
 */
export async function storeFile(file: File): Promise<string> {
  const db = getOfflineDB();
  
  const fileId = uuidv4();
  const stored: StoredFile = {
    id: fileId,
    blob: file,
    mime: file.type,
    name: file.name,
    size: file.size,
    createdAt: Date.now(),
  };
  
  await db.files.add(stored);
  return fileId;
}

/**
 * Get stored file
 */
export async function getFile(fileId: string): Promise<StoredFile | undefined> {
  const db = getOfflineDB();
  return db.files.get(fileId);
}

/**
 * Delete stored file
 */
export async function deleteFile(fileId: string): Promise<void> {
  const db = getOfflineDB();
  await db.files.delete(fileId);
}

/**
 * Get file as Blob
 */
export async function getFileBlob(fileId: string): Promise<Blob | null> {
  const file = await getFile(fileId);
  return file?.blob || null;
}

