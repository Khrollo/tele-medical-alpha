/**
 * Outbox repository - re-exports and extends existing outbox functionality
 */
export {
  queueMutation,
  queueFileUpload,
  getQueuedOperations,
  getOperationsByStatus,
  getOperation,
  updateOperationStatus,
  setOperationRetry,
  deleteOperation,
  getOperationCounts,
  getReadyOperations,
} from "../outbox";

import { getOfflineDB, type OutboxOperation } from "../db";
import { updateOperationStatus, setOperationRetry, deleteOperation } from "../outbox";
import { getFile } from "../files";

/**
 * Process a single outbox operation
 * This is a helper that will be used by the sync engine
 */
export async function processOperation(
  op: OutboxOperation
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  try {
    // Mark as syncing
    await updateOperationStatus(op.id, "syncing");
    
    // Handle file uploads
    let body: BodyInit | undefined;
    let headers: HeadersInit = {};
    
    if (op.fileIds && op.fileIds.length > 0) {
      // File upload - use FormData
      const formData = new FormData();
      const payload = JSON.parse(op.payloadJson);
      
      // Add file(s)
      for (const fileId of op.fileIds) {
        const file = await getFile(fileId);
        if (file) {
          formData.append("file", file.blob, file.name);
        }
      }
      
      // Add other payload fields
      for (const [key, value] of Object.entries(payload)) {
        if (key !== "file" && key !== "files") {
          formData.append(key, String(value));
        }
      }
      
      body = formData;
      // Don't set Content-Type for FormData - browser will set it with boundary
    } else {
      // JSON request
      headers["Content-Type"] = "application/json";
      body = op.method !== "GET" ? op.payloadJson : undefined;
    }
    
    // Execute the operation
    const response = await fetch(op.endpoint, {
      method: op.method,
      headers,
      body,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Mark as completed
    await updateOperationStatus(op.id, "completed");
    
    // Delete after successful completion
    await deleteOperation(op.id);
    
    return { success: true, response: data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a retryable error (network error or 5xx)
    const isRetryable = 
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.startsWith("HTTP 5");
    
    if (isRetryable && op.attempts < 8) {
      // Calculate exponential backoff (cap at 60s)
      const backoffMs = Math.min(1000 * Math.pow(2, op.attempts), 60000);
      const retryAt = Date.now() + backoffMs;
      
      await setOperationRetry(op.id, retryAt);
      await updateOperationStatus(op.id, "queued", errorMessage);
    } else {
      // Permanent failure
      await updateOperationStatus(op.id, "failed", errorMessage);
    }
    
    return { success: false, error: errorMessage };
  }
}
