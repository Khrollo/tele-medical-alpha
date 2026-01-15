import { isOnline } from "./sync/network";
import { queueMutation } from "./outbox";
import * as patientsRepo from "./repos/patients.repo";
import * as visitsRepo from "./repos/visits.repo";
import * as documentsRepo from "./repos/documents.repo";

interface SubmitOptions {
  action: () => Promise<unknown>;
  actionType: string;
  endpoint: string;
  payload: Record<string, unknown>;
  optimisticUpdate?: {
    entityType: "patient" | "visit" | "document";
    entityId: string;
    updates: Record<string, unknown>;
  };
  onSuccess?: (result: unknown) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Submit with offline support
 * If offline, queues the mutation and applies optimistic update
 * If online, executes immediately and updates cache
 */
export async function submitWithOffline(
  options: SubmitOptions
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const {
    action,
    actionType,
    endpoint,
    payload,
    optimisticUpdate,
    onSuccess,
    onError,
  } = options;

  const online = isOnline();

  // If offline, queue the mutation
  if (!online) {
    try {
      // Apply optimistic update if provided
      if (optimisticUpdate) {
        switch (optimisticUpdate.entityType) {
          case "patient":
            await patientsRepo.applyOptimistic(
              optimisticUpdate.entityId,
              optimisticUpdate.updates
            );
            break;
          case "visit":
            await visitsRepo.applyOptimistic(
              optimisticUpdate.entityId,
              optimisticUpdate.updates
            );
            break;
          case "document":
            await documentsRepo.upsertFromServer({
              id: optimisticUpdate.entityId,
              patientId: payload.patientId as string,
              ...optimisticUpdate.updates,
            } as { id: string; patientId: string; [key: string]: unknown });
            break;
        }
      }

      // Queue mutation
      await queueMutation({
        type: actionType,
        endpoint,
        method: "POST",
        payloadJson: JSON.stringify(payload),
      });

      // Call success callback
      if (onSuccess) {
        await onSuccess({ queued: true });
      }

      return { success: true, data: { queued: true } };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      }
      return { success: false, error: err.message };
    }
  }

  // If online, execute immediately
  try {
    const result = await action();

    // Update cache based on result
    if (result && typeof result === "object") {
      if ("id" in result && "patientId" in result) {
        // Likely a visit or document
        if (actionType.includes("visit")) {
          await visitsRepo.upsertFromServer(
            result as { id: string; patientId: string; [key: string]: unknown }
          );
        } else if (actionType.includes("document")) {
          await documentsRepo.upsertFromServer(
            result as { id: string; patientId: string; [key: string]: unknown }
          );
        }
      } else if ("id" in result && !("patientId" in result)) {
        // Likely a patient
        if (actionType.includes("patient")) {
          await patientsRepo.upsertFromServer(
            result as { id: string; [key: string]: unknown }
          );
        }
      }
    }

    // Call success callback
    if (onSuccess) {
      await onSuccess(result);
    }

    return { success: true, data: result };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    
    // If it's a network error, queue it
    if (
      err.message.includes("fetch") ||
      err.message.includes("network") ||
      err.message.includes("Failed to fetch")
    ) {
      try {
        // Apply optimistic update
        if (optimisticUpdate) {
          switch (optimisticUpdate.entityType) {
            case "patient":
              await patientsRepo.applyOptimistic(
                optimisticUpdate.entityId,
                optimisticUpdate.updates
              );
              break;
            case "visit":
              await visitsRepo.applyOptimistic(
                optimisticUpdate.entityId,
                optimisticUpdate.updates
              );
              break;
            case "document":
              await documentsRepo.upsertFromServer({
                id: optimisticUpdate.entityId,
                patientId: payload.patientId as string,
                ...optimisticUpdate.updates,
              } as { id: string; patientId: string; [key: string]: unknown });
              break;
          }
        }

        // Queue mutation
        await queueMutation({
          type: actionType,
          endpoint,
          method: "POST",
          payloadJson: JSON.stringify(payload),
        });

        if (onSuccess) {
          await onSuccess({ queued: true });
        }

        return { success: true, data: { queued: true } };
      } catch (queueError) {
        console.error("Error queueing mutation:", queueError);
      }
    }

    if (onError) {
      onError(err);
    }

    return { success: false, error: err.message };
  }
}
