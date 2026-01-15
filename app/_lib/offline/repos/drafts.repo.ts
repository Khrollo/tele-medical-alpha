import { getOfflineDB, type FormDraft } from "../db";

/**
 * Generate draft key
 */
export function getDraftKey(
  userId: string,
  formName: string,
  route: string,
  entityId?: string
): string {
  return `${userId}:${formName}:${route}:${entityId ?? "none"}`;
}

/**
 * Save form draft
 */
export async function saveDraft(
  userId: string,
  formName: string,
  route: string,
  entityId: string | undefined,
  data: unknown
): Promise<void> {
  const db = getOfflineDB();
  const draftKey = getDraftKey(userId, formName, route, entityId);
  
  const draft: FormDraft = {
    draftKey,
    userId,
    formName,
    route,
    entityId,
    data: JSON.stringify(data),
    updatedAt: Date.now(),
  };
  
  await db.drafts.put(draft);
}

/**
 * Load form draft
 */
export async function loadDraft(
  userId: string,
  formName: string,
  route: string,
  entityId?: string
): Promise<unknown | null> {
  const db = getOfflineDB();
  const draftKey = getDraftKey(userId, formName, route, entityId);
  
  const draft = await db.drafts.get(draftKey);
  if (!draft) {
    return null;
  }
  
  try {
    return JSON.parse(draft.data);
  } catch {
    return null;
  }
}

/**
 * Clear draft after successful submit
 */
export async function clearDraft(
  userId: string,
  formName: string,
  route: string,
  entityId?: string
): Promise<void> {
  const db = getOfflineDB();
  const draftKey = getDraftKey(userId, formName, route, entityId);
  
  await db.drafts.delete(draftKey);
}

/**
 * List drafts for a user
 */
export async function listDrafts(
  userId: string,
  formName?: string
): Promise<FormDraft[]> {
  const db = getOfflineDB();
  
  if (formName) {
    return db.drafts
      .where("[userId+formName]")
      .equals([userId, formName])
      .toArray();
  }
  
  return db.drafts
    .where("userId")
    .equals(userId)
    .toArray();
}
