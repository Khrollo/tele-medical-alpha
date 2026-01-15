"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { UseFormReturn, FieldValues } from "react-hook-form";
import { saveDraft, loadDraft, clearDraft } from "@/app/_lib/offline/repos/drafts.repo";
import { useDebounceCallback } from "@/app/_lib/hooks/use-debounce-callback";

interface UseFormDraftOptions<T extends FieldValues> {
  userId: string;
  formName: string;
  entityId?: string;
  form: UseFormReturn<T>;
  enabled?: boolean;
  debounceMs?: number;
}

/**
 * Hook for automatic form draft persistence
 * Auto-saves form state on changes and restores on mount
 */
export function useFormDraft<T extends FieldValues>({
  userId,
  formName,
  entityId,
  form,
  enabled = true,
  debounceMs = 500,
}: UseFormDraftOptions<T>) {
  const pathname = usePathname();
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

  // Debounced save function
  const debouncedSave = useDebounceCallback(
    async (data: T) => {
      if (!enabled || isRestoringRef.current) return;
      
      try {
        await saveDraft(userId, formName, pathname, entityId, data);
      } catch (error) {
        console.error("Error saving draft:", error);
      }
    },
    debounceMs
  );

  // Restore draft on mount
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;

    const restore = async () => {
      try {
        isRestoringRef.current = true;
        const draft = await loadDraft(userId, formName, pathname, entityId);
        
        if (draft) {
          form.reset(draft as T);
        }
      } catch (error) {
        console.error("Error restoring draft:", error);
      } finally {
        isRestoringRef.current = false;
        hasRestoredRef.current = true;
      }
    };

    restore();
  }, [userId, formName, pathname, entityId, form, enabled]);

  // Watch for form changes and auto-save
  useEffect(() => {
    if (!enabled || !hasRestoredRef.current) return;

    const subscription = form.watch((data) => {
      debouncedSave(data as T);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [form, debouncedSave, enabled, hasRestoredRef.current]);

  // Clear draft on successful submit
  const clearDraftOnSubmit = useCallback(async () => {
    if (!enabled) return;
    
    try {
      await clearDraft(userId, formName, pathname, entityId);
    } catch (error) {
      console.error("Error clearing draft:", error);
    }
  }, [userId, formName, pathname, entityId, enabled]);

  return {
    clearDraft: clearDraftOnSubmit,
  };
}
