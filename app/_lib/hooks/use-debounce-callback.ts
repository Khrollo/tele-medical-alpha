"use client";

import { useRef, useCallback } from "react";

/**
 * Hook for debouncing callbacks
 * Supports both sync and async functions
 */
export function useDebounceCallback<T extends (...args: any[]) => void | Promise<void>>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );

  return debouncedCallback;
}
