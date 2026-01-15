"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import * as patientsRepo from "@/app/_lib/offline/repos/patients.repo";
import * as visitsRepo from "@/app/_lib/offline/repos/visits.repo";
import * as documentsRepo from "@/app/_lib/offline/repos/documents.repo";
import { isOnline } from "@/app/_lib/offline/sync/network";

interface PatientCacheContextValue {
  getPatient: (patientId: string) => Promise<unknown | null>;
  getVisits: (patientId: string) => Promise<unknown[]>;
  getDocuments: (patientId: string, visitId?: string) => Promise<unknown[]>;
  refreshPatient: (patientId: string) => Promise<void>;
  refreshVisits: (patientId: string) => Promise<void>;
  refreshDocuments: (patientId: string, visitId?: string) => Promise<void>;
}

const PatientCacheContext = createContext<PatientCacheContextValue | undefined>(
  undefined
);

export function usePatientCache() {
  const context = useContext(PatientCacheContext);
  if (!context) {
    throw new Error("usePatientCache must be used within PatientCacheProvider");
  }
  return context;
}

export function PatientCacheProvider({ children }: { children: ReactNode }) {
  // In-memory cache
  const [patientCache, setPatientCache] = useState<Map<string, unknown>>(
    new Map()
  );
  const [visitsCache, setVisitsCache] = useState<Map<string, unknown[]>>(
    new Map()
  );
  const [documentsCache, setDocumentsCache] = useState<
    Map<string, unknown[]>
  >(new Map());

  /**
   * Get patient - checks in-memory cache, then Dexie, then fetches from server
   */
  const getPatient = useCallback(
    async (patientId: string): Promise<unknown | null> => {
      // Check in-memory cache first
      if (patientCache.has(patientId)) {
        return patientCache.get(patientId) || null;
      }

      // Check Dexie
      const cached = await patientsRepo.getCached(patientId);
      if (cached) {
        const data = cached.data;
        setPatientCache((prev) => new Map(prev).set(patientId, data));
        return data;
      }

      // Fetch from server if online
      if (isOnline()) {
        try {
          const response = await fetch(`/api/patients/${patientId}`);
          if (response.ok) {
            const data = await response.json();
            await patientsRepo.upsertFromServer(data);
            setPatientCache((prev) => new Map(prev).set(patientId, data));
            return data;
          }
        } catch (error) {
          console.error("Error fetching patient:", error);
        }
      }

      return null;
    },
    [patientCache]
  );

  /**
   * Get visits for a patient
   */
  const getVisits = useCallback(
    async (patientId: string): Promise<unknown[]> => {
      const cacheKey = patientId;

      // Check in-memory cache
      if (visitsCache.has(cacheKey)) {
        return visitsCache.get(cacheKey) || [];
      }

      // Check Dexie
      const cached = await visitsRepo.getCachedByPatient(patientId);
      if (cached.length > 0) {
        const data = cached.map((c) => c.data);
        setVisitsCache((prev) => new Map(prev).set(cacheKey, data));
        return data;
      }

      // Fetch from server if online
      if (isOnline()) {
        try {
          const response = await fetch(`/api/patients/${patientId}/visits`);
          if (response.ok) {
            const visits = await response.json();
            for (const visit of visits) {
              await visitsRepo.upsertFromServer(visit);
            }
            setVisitsCache((prev) => new Map(prev).set(cacheKey, visits));
            return visits;
          }
        } catch (error) {
          console.error("Error fetching visits:", error);
        }
      }

      return [];
    },
    [visitsCache]
  );

  /**
   * Get documents for a patient/visit
   */
  const getDocuments = useCallback(
    async (patientId: string, visitId?: string): Promise<unknown[]> => {
      const cacheKey = visitId ? `${patientId}:${visitId}` : patientId;

      // Check in-memory cache
      if (documentsCache.has(cacheKey)) {
        return documentsCache.get(cacheKey) || [];
      }

      // Check Dexie
      const cached = await documentsRepo.listCached(patientId, visitId);
      if (cached.length > 0) {
        const data = cached.map((c) => c.data);
        setDocumentsCache((prev) => new Map(prev).set(cacheKey, data));
        return data;
      }

      // Fetch from server if online
      if (isOnline()) {
        try {
          const endpoint = visitId
            ? `/api/patients/${patientId}/documents?visitId=${visitId}`
            : `/api/patients/${patientId}/documents`;
          const response = await fetch(endpoint);
          if (response.ok) {
            const documents = await response.json();
            for (const doc of documents) {
              await documentsRepo.upsertFromServer(doc);
            }
            setDocumentsCache((prev) => new Map(prev).set(cacheKey, documents));
            return documents;
          }
        } catch (error) {
          console.error("Error fetching documents:", error);
        }
      }

      return [];
    },
    [documentsCache]
  );

  /**
   * Refresh patient from server
   */
  const refreshPatient = useCallback(
    async (patientId: string): Promise<void> => {
      if (!isOnline()) return;

      try {
        const response = await fetch(`/api/patients/${patientId}`);
        if (response.ok) {
          const data = await response.json();
          await patientsRepo.upsertFromServer(data);
          setPatientCache((prev) => new Map(prev).set(patientId, data));
        }
      } catch (error) {
        console.error("Error refreshing patient:", error);
      }
    },
    []
  );

  /**
   * Refresh visits from server
   */
  const refreshVisits = useCallback(
    async (patientId: string): Promise<void> => {
      if (!isOnline()) return;

      try {
        const response = await fetch(`/api/patients/${patientId}/visits`);
        if (response.ok) {
          const visits = await response.json();
          for (const visit of visits) {
            await visitsRepo.upsertFromServer(visit);
          }
          const cacheKey = patientId;
          setVisitsCache((prev) => new Map(prev).set(cacheKey, visits));
        }
      } catch (error) {
        console.error("Error refreshing visits:", error);
      }
    },
    []
  );

  /**
   * Refresh documents from server
   */
  const refreshDocuments = useCallback(
    async (patientId: string, visitId?: string): Promise<void> => {
      if (!isOnline()) return;

      try {
        const endpoint = visitId
          ? `/api/patients/${patientId}/documents?visitId=${visitId}`
          : `/api/patients/${patientId}/documents`;
        const response = await fetch(endpoint);
        if (response.ok) {
          const documents = await response.json();
          for (const doc of documents) {
            await documentsRepo.upsertFromServer(doc);
          }
          const cacheKey = visitId ? `${patientId}:${visitId}` : patientId;
          setDocumentsCache((prev) => new Map(prev).set(cacheKey, documents));
        }
      } catch (error) {
        console.error("Error refreshing documents:", error);
      }
    },
    []
  );

  return (
    <PatientCacheContext.Provider
      value={{
        getPatient,
        getVisits,
        getDocuments,
        refreshPatient,
        refreshVisits,
        refreshDocuments,
      }}
    >
      {children}
    </PatientCacheContext.Provider>
  );
}

/**
 * Hook to get patient data
 */
export function usePatient(patientId: string) {
  const { getPatient, refreshPatient } = usePatientCache();
  const [patient, setPatient] = useState<unknown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const data = await getPatient(patientId);
      if (mounted) {
        setPatient(data);
        setLoading(false);
      }
    };

    load();

    // Refresh in background if online
    if (isOnline()) {
      refreshPatient(patientId).catch(console.error);
    }

    return () => {
      mounted = false;
    };
  }, [patientId, getPatient, refreshPatient]);

  return { patient, loading, refresh: () => refreshPatient(patientId) };
}

/**
 * Hook to get patient visits
 */
export function usePatientVisits(patientId: string) {
  const { getVisits, refreshVisits } = usePatientCache();
  const [visits, setVisits] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const data = await getVisits(patientId);
      if (mounted) {
        setVisits(data);
        setLoading(false);
      }
    };

    load();

    // Refresh in background if online
    if (isOnline()) {
      refreshVisits(patientId).catch(console.error);
    }

    return () => {
      mounted = false;
    };
  }, [patientId, getVisits, refreshVisits]);

  return { visits, loading, refresh: () => refreshVisits(patientId) };
}

/**
 * Hook to get patient documents
 */
export function usePatientDocuments(patientId: string, visitId?: string) {
  const { getDocuments, refreshDocuments } = usePatientCache();
  const [documents, setDocuments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const data = await getDocuments(patientId, visitId);
      if (mounted) {
        setDocuments(data);
        setLoading(false);
      }
    };

    load();

    // Refresh in background if online
    if (isOnline()) {
      refreshDocuments(patientId, visitId).catch(console.error);
    }

    return () => {
      mounted = false;
    };
  }, [patientId, visitId, getDocuments, refreshDocuments]);

  return {
    documents,
    loading,
    refresh: () => refreshDocuments(patientId, visitId),
  };
}
