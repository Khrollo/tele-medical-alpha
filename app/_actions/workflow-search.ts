"use server";

import { requireUser } from "@/app/_lib/auth/get-current-user";
import { getAllPatients, getUnassignedPatientsWithVisits } from "@/app/_lib/db/drizzle/queries/patients";
import { getClinicianOpenVisits } from "@/app/_lib/db/drizzle/queries/visit";

export type WorkflowSearchGroup =
  | "patients"
  | "notes"
  | "schedules"
  | "destinations";

export interface WorkflowSearchItem {
  id: string;
  group: WorkflowSearchGroup;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

export interface WorkflowSearchResults {
  patients: WorkflowSearchItem[];
  notes: WorkflowSearchItem[];
  schedules: WorkflowSearchItem[];
  destinations: WorkflowSearchItem[];
}

function matchesQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

function getMatchScore(query: string, ...values: Array<string | null | undefined>) {
  if (!query) return 999;

  const normalizedValues = values.filter(Boolean).map((value) => value!.toLowerCase());

  if (normalizedValues.some((value) => value === query)) return 0;
  if (normalizedValues.some((value) => value.startsWith(query))) return 1;
  if (normalizedValues.some((value) => value.includes(query))) return 2;
  return 99;
}

function sortByScore<T>(items: T[], scoreFor: (item: T) => number) {
  return [...items].sort((a, b) => scoreFor(a) - scoreFor(b));
}

const EMPTY_RESULTS: WorkflowSearchResults = {
  patients: [],
  notes: [],
  schedules: [],
  destinations: [],
};

export async function searchWorkflowAction(
  rawQuery?: string
): Promise<WorkflowSearchResults> {
  // Auth is still hard: unauthenticated / wrong-role callers must not see
  // anything. But we surface this as empty results rather than throwing so
  // the client search input doesn't explode the whole segment on every
  // keystroke while a session is refreshing. The server still logs the
  // rejection for observability.
  let user;
  try {
    user = await requireUser(["doctor", "nurse"]);
  } catch (err) {
    console.warn("[workflow-search] auth rejected", err);
    return EMPTY_RESULTS;
  }

  const query = (rawQuery || "").trim().toLowerCase();

  // Isolate each data source. A single failing query (e.g. a transient DB
  // blip on clinician inbox) used to reject the entire Promise.all and
  // crash the client. Per-source fallback lets the dropdown show partial
  // results instead of nothing.
  const safe = async <T>(p: Promise<T>, label: string, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (err) {
      console.error(`[workflow-search] ${label} failed`, err);
      return fallback;
    }
  };

  const [patients, schedulePatients, clinicianOpenVisits] = await Promise.all([
    safe(getAllPatients(), "getAllPatients", []),
    safe(getUnassignedPatientsWithVisits(), "getUnassignedPatientsWithVisits", []),
    user.role === "doctor"
      ? safe(getClinicianOpenVisits(user.id), "getClinicianOpenVisits", [])
      : Promise.resolve([]),
  ]);

  const patientResults = sortByScore(
    patients.filter((patient) =>
      matchesQuery(
        query,
        patient.fullName,
        patient.phone,
        patient.email,
        patient.clinicianName,
        patient.clinicianEmail
      )
    ),
    (patient) =>
      getMatchScore(
        query,
        patient.fullName,
        patient.phone,
        patient.email,
        patient.clinicianName,
        patient.clinicianEmail
      )
  )
    .slice(0, query ? 5 : 3)
    .map((patient) => ({
      id: `patient:${patient.id}`,
      group: "patients" as const,
      title: patient.fullName,
      subtitle: patient.visit
        ? `Chart overview • ${patient.visit.status || "No status"}`
        : "Chart overview",
      href: `/patients/${patient.id}`,
      badge: "Chart",
    }));

  const noteResults = sortByScore(
    patients.flatMap((patient) => {
      const items: WorkflowSearchItem[] = [
        {
          id: `history:${patient.id}`,
          group: "notes",
          title: `${patient.fullName} visit history`,
          subtitle: "Review prior signed and unsigned documentation",
          href: `/patients/${patient.id}/visit-history`,
          badge: "Notes",
        },
        {
          id: `log:${patient.id}`,
          group: "notes",
          title: `${patient.fullName} visit log`,
          subtitle: "Open operational log timeline",
          href: `/patients/${patient.id}/log-history`,
          badge: "Log",
        },
      ];

      if (patient.visit?.id) {
        items.unshift({
          id: `active:${patient.visit.id}`,
          group: "notes",
          title: `${patient.fullName} active note`,
          subtitle: `${patient.visit.status || "In Progress"} • continue open documentation`,
          href: `/patients/${patient.id}/new-visit?visitId=${patient.visit.id}`,
          badge: "Active",
        });
      } else {
        items.unshift({
          id: `new:${patient.id}`,
          group: "notes",
          title: `${patient.fullName} new note`,
          subtitle: "Start a new encounter note",
          href: `/patients/${patient.id}/new-visit`,
          badge: "New",
        });
      }

      return items;
    }).filter((item) => matchesQuery(query, item.title, item.subtitle, item.badge)),
    (item) => getMatchScore(query, item.title, item.subtitle, item.badge)
  ).slice(0, query ? 8 : 5);

  const scheduleResults = sortByScore(
    [
      ...schedulePatients.map((patient) => ({
        id: `schedule:${patient.visit?.id || patient.id}`,
        group: "schedules" as const,
        title: `${patient.fullName} schedule item`,
        subtitle: patient.visit
          ? `${patient.visit.priority || "Not set"} • ${patient.visit.appointmentType || "Visit"}`
          : "Unassigned patient",
        href: patient.visit?.id
          ? `/patients/${patient.id}/new-visit?visitId=${patient.visit.id}`
          : `/patients/${patient.id}/new-visit`,
        badge: "Schedule",
      })),
      ...clinicianOpenVisits.map((visit) => ({
        id: `inbox:${visit.id}`,
        group: "schedules" as const,
        title: `${visit.patientName} assigned slot`,
        subtitle: `${visit.status || "In Progress"} • continue assigned note`,
        href: `/patients/${visit.patientId}/new-visit?visitId=${visit.id}`,
        badge: "Assigned",
      })),
    ].filter((item) => matchesQuery(query, item.title, item.subtitle, item.badge)),
    (item) => getMatchScore(query, item.title, item.subtitle, item.badge)
  ).slice(0, query ? 8 : 6);

  const destinations = sortByScore(
    [
      {
        id: "dest:patients",
        group: "destinations" as const,
        title: "Patients",
        subtitle: "Browse patient charts",
        href: "/patients",
        badge: "Page",
      },
      {
        id: "dest:schedule",
        group: "destinations" as const,
        title: "Schedule",
        subtitle: "Open the schedule board",
        href: "/waiting-room",
        badge: "Page",
      },
      {
        id: "dest:inbox",
        group: "destinations" as const,
        title: "Inbox",
        subtitle: "Open assigned notes and workflow tasks",
        href: "/open-notes",
        badge: "Page",
      },
      {
        id: "dest:new-patient",
        group: "destinations" as const,
        title: "New Patient",
        subtitle: "Register a new patient",
        href: "/patients/new",
        badge: "Create",
      },
    ].filter((item) => matchesQuery(query, item.title, item.subtitle)),
    (item) => getMatchScore(query, item.title, item.subtitle)
  );

  return {
    patients: patientResults,
    notes: noteResults,
    schedules: scheduleResults,
    destinations,
  };
}
