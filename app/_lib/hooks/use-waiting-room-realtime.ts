"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { fetchWaitingRoomPatientsAction } from "@/app/_actions/waiting-room";
import type { WorkflowFlags } from "@/app/_lib/utils/patient-workflow-chips";

interface VisitInfo {
  id: string;
  priority: string | null;
  appointmentType: string | null;
  createdAt: Date;
  status: string | null;
  clinicianId: string | null;
  twilioRoomName: string | null;
  patientJoinToken: string | null;
  chiefComplaint: string | null;
}

interface Patient {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  dob: string | null;
  allergiesCount: number;
  medicationsCount: number;
  createdAt: Date | null;
  visit: VisitInfo | null;
  workflow?: WorkflowFlags | null;
}

interface UseWaitingRoomRealtimeOptions {
  initialPatients: Patient[];
  onError?: (error: Error) => void;
}

interface UseWaitingRoomRealtimeReturn {
  patients: Patient[];
  isConnected: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to poll for waiting room updates via server action.
 * Polls every 3 seconds using a Drizzle-backed server action.
 */
export function useWaitingRoomRealtime({
  initialPatients,
  onError,
}: UseWaitingRoomRealtimeOptions): UseWaitingRoomRealtimeReturn {
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  // Once the server action rejects with an auth error we stop polling entirely
  // — continuing to hammer the endpoint every 3s after a 401/403 is wasted
  // work and hides the real problem behind an infinite retry loop. The user
  // can recover by refreshing (which re-runs the page's server auth check and
  // either redirects to /sign-in or returns them to the board).
  const isAuthBlockedRef = useRef<boolean>(false);
  const fetchAllPatientsRef = useRef<(() => Promise<void>) | undefined>(
    undefined
  );

  const fetchAllPatients = useCallback(async () => {
    if (isFetchingRef.current || isAuthBlockedRef.current) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const result = await fetchWaitingRoomPatientsAction();

      const transformedPatients: Patient[] = result.map((patient) => ({
        id: patient.id,
        fullName: patient.fullName,
        avatarUrl: patient.avatarUrl,
        dob: patient.dob,
        allergiesCount: patient.allergiesCount,
        medicationsCount: patient.medicationsCount,
        createdAt: patient.createdAt ? new Date(patient.createdAt) : null,
        workflow: patient.workflow ?? null,
        visit: patient.visit
          ? {
              id: patient.visit.id,
              priority: patient.visit.priority,
              appointmentType: patient.visit.appointmentType,
              createdAt: new Date(patient.visit.createdAt),
              status: patient.visit.status,
              clinicianId: patient.visit.clinicianId,
              twilioRoomName: patient.visit.twilioRoomName,
              patientJoinToken: patient.visit.patientJoinToken,
              chiefComplaint: patient.visit.chiefComplaint,
            }
          : null,
      }));

      setPatients(transformedPatients);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error("Failed to fetch waiting room patients");

      // Auth failures are terminal for the polling session. `requireUser`
      // throws literal "Unauthorized" / "Forbidden" strings; we match on
      // those because Next.js server actions don't expose HTTP status codes
      // to the client. If we keep polling on auth failure we'll trip rate
      // limits and spam server logs with the same rejection every 3s.
      const msg = error.message.toLowerCase();
      if (msg.includes("unauthorized") || msg.includes("forbidden")) {
        isAuthBlockedRef.current = true;
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }

      setError(error);
      setIsConnected(false);
      onError?.(error);
      console.error("Error fetching waiting room patients:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [onError]);

  useEffect(() => {
    fetchAllPatientsRef.current = fetchAllPatients;
  }, [fetchAllPatients]);

  const refresh = useCallback(async () => {
    await fetchAllPatients();
  }, [fetchAllPatients]);

  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    if (fetchAllPatientsRef.current) {
      fetchAllPatientsRef.current();
    }

    pollingIntervalRef.current = setInterval(() => {
      if (fetchAllPatientsRef.current) {
        fetchAllPatientsRef.current();
      }
    }, 3000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setPatients(initialPatients);
  }, [initialPatients]);

  return {
    patients,
    isConnected,
    error,
    refresh,
  };
}
