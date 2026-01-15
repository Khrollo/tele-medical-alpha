/**
 * Network status utilities for offline detection
 */

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") {
    return true; // Assume online on server
  }
  return navigator.onLine;
}

/**
 * Listen for online events
 */
export function onOnline(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {}; // No-op on server
  }
  
  window.addEventListener("online", callback);
  
  return () => {
    window.removeEventListener("online", callback);
  };
}

/**
 * Listen for offline events
 */
export function onOffline(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {}; // No-op on server
  }
  
  window.addEventListener("offline", callback);
  
  return () => {
    window.removeEventListener("offline", callback);
  };
}

/**
 * Check network status with a fetch test
 * More reliable than navigator.onLine alone
 */
export async function checkNetworkStatus(): Promise<boolean> {
  if (typeof window === "undefined") {
    return true;
  }
  
  if (!navigator.onLine) {
    return false;
  }
  
  try {
    // Try to fetch a small resource with cache-busting
    const response = await fetch("/api/health-check?t=" + Date.now(), {
      method: "HEAD",
      cache: "no-cache",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}
