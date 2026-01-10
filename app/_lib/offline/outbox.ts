import { getOfflineDB, type OutboxOperation } from "./db";
import { v4 as uuidv4 } from "uuid";

/**
 * Queue a mutation operation
 */
export async function queueMutation(
  operation: Omit<OutboxOperation, "id" | "createdAt" | "status" | "attempts">
): Promise<string> {
  const db = getOfflineDB();
  
  const opId = uuidv4();
  const op: OutboxOperation = {
    id: opId,
    createdAt: Date.now(),
    status: "queued",
    attempts: 0,
    ...operation,
  };
  
  await db.outbox.add(op);
  return opId;
}

/**
 * Queue a file upload
 */
export async function queueFileUpload(
  fileId: string,
  endpoint: string,
  payload: Record<string, unknown>,
  dependsOn?: string[]
): Promise<string> {
  return queueMutation({
    type: "upload_file",
    endpoint,
    method: "POST",
    payloadJson: JSON.stringify(payload),
    fileIds: [fileId],
    dependsOn,
  });
}

/**
 * Get all queued operations
 */
export async function getQueuedOperations(): Promise<OutboxOperation[]> {
  const db = getOfflineDB();
  
  return db.outbox
    .where("status")
    .equals("queued")
    .sortBy("createdAt");
}

/**
 * Get operations by status
 */
export async function getOperationsByStatus(
  status: OutboxOperation["status"]
): Promise<OutboxOperation[]> {
  const db = getOfflineDB();
  
  return db.outbox
    .where("status")
    .equals(status)
    .sortBy("createdAt");
}

/**
 * Get operation by ID
 */
export async function getOperation(id: string): Promise<OutboxOperation | undefined> {
  const db = getOfflineDB();
  return db.outbox.get(id);
}

/**
 * Update operation status
 */
export async function updateOperationStatus(
  id: string,
  status: OutboxOperation["status"],
  error?: string
): Promise<void> {
  const db = getOfflineDB();
  
  const updates: Partial<OutboxOperation> = {
    status,
  };
  
  if (error) {
    updates.lastError = error;
  }
  
  if (status === "syncing") {
    // Increment attempts
    const op = await db.outbox.get(id);
    if (op) {
      updates.attempts = op.attempts + 1;
    }
  }
  
  await db.outbox.update(id, updates);
}

/**
 * Set retry time for failed operation
 */
export async function setOperationRetry(
  id: string,
  retryAt: number
): Promise<void> {
  const db = getOfflineDB();
  await db.outbox.update(id, { retryAt });
}

/**
 * Delete completed operation
 */
export async function deleteOperation(id: string): Promise<void> {
  const db = getOfflineDB();
  await db.outbox.delete(id);
}

/**
 * Get count of operations by status
 */
export async function getOperationCounts(): Promise<{
  queued: number;
  syncing: number;
  failed: number;
  completed: number;
}> {
  const db = getOfflineDB();
  
  const [queued, syncing, failed, completed] = await Promise.all([
    db.outbox.where("status").equals("queued").count(),
    db.outbox.where("status").equals("syncing").count(),
    db.outbox.where("status").equals("failed").count(),
    db.outbox.where("status").equals("completed").count(),
  ]);
  
  return { queued, syncing, failed, completed };
}

/**
 * Get operations that are ready to sync (no dependencies or dependencies completed)
 */
export async function getReadyOperations(): Promise<OutboxOperation[]> {
  const db = getOfflineDB();
  
  const queued = await getQueuedOperations();
  const ready: OutboxOperation[] = [];
  
  for (const op of queued) {
    if (!op.dependsOn || op.dependsOn.length === 0) {
      ready.push(op);
      continue;
    }
    
    // Check if all dependencies are completed
    const deps = await Promise.all(
      op.dependsOn.map((depId) => db.outbox.get(depId))
    );
    
    const allCompleted = deps.every(
      (dep) => dep && dep.status === "completed"
    );
    
    if (allCompleted) {
      ready.push(op);
    }
  }
  
  return ready.sort((a, b) => a.createdAt - b.createdAt);
}

