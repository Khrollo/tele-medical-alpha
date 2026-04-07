import { eq, desc, and, gte, lte, count, max } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../index";
import { visits, patients, notes } from "../schema";

export interface GetVisitHistoryOptions {
  page?: number;
  pageSize?: number;
  status?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface VisitHistoryResult {
  patient: {
    id: string;
    fullName: string;
  };
  visits: Array<{
    id: string;
    patientId: string;
    clinicianId: string | null;
    audioUrl: string | null;
    status: string | null;
    createdAt: Date;
    notesStatus: string | null;
    notesFinalizedBy: string | null;
    notesFinalizedAt: Date | null;
    priority: string | null;
    appointmentType: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface VisitHistoryPreviewEntry {
  id: string;
  status: string | null;
  createdAt: Date;
  appointmentType: string | null;
  priority: string | null;
  note: unknown;
}

/**
 * Get visit history for a patient with pagination and filtering
 * @param patientId - UUID of the patient
 * @param opts - Options for pagination and filtering
 * @returns Visit history with patient info, visits, pagination metadata
 */
export async function getVisitHistory(
  patientId: string,
  opts: GetVisitHistoryOptions = {}
): Promise<VisitHistoryResult | null> {
  const {
    page = 1,
    pageSize = 20,
    status = null,
    from = null,
    to = null,
  } = opts;

  // Create cache key from options
  const cacheKey = `visit-history-${patientId}-${page}-${pageSize}-${status || "all"}-${from || "none"}-${to || "none"}`;

  return unstable_cache(
    async () => {

  // Verify patient exists
  const patient = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient[0]) {
    return null;
  }

  // Build where conditions
  const conditions = [eq(visits.patientId, patientId)];

  if (status) {
    conditions.push(eq(visits.status, status));
  }

  if (from) {
    const fromDate = new Date(from);
    conditions.push(gte(visits.createdAt, fromDate));
  }

  if (to) {
    const toDate = new Date(to);
    // Set to end of day
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(visits.createdAt, toDate));
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  // Get total count
  const totalResult = await db
    .select({ count: count() })
    .from(visits)
    .where(whereClause);

  const total = totalResult[0]?.count ?? 0;

  // Get paginated visits
  const offset = (page - 1) * pageSize;

  const visitsResult = await db
    .select()
    .from(visits)
    .where(whereClause)
    .orderBy(desc(visits.createdAt))
    .limit(pageSize)
    .offset(offset);

      return {
        patient: patient[0],
        visits: visitsResult,
        total,
        page,
        pageSize,
      };
    },
    [cacheKey],
    {
      tags: [`visits:${patientId}`, `patient:${patientId}`],
      revalidate: 60,
    }
  )();
}

export async function getRecentVisitHistoryPreview(
  patientId: string,
  limit = 5
): Promise<VisitHistoryPreviewEntry[]> {
  const latestNotePerVisit = db
    .select({
      visitId: notes.visitId,
      latestCreatedAt: max(notes.createdAt).as("latest_created_at"),
    })
    .from(notes)
    .groupBy(notes.visitId)
    .as("latest_note_per_visit");

  const visitRows = await db
    .select({
      id: visits.id,
      status: visits.status,
      createdAt: visits.createdAt,
      appointmentType: visits.appointmentType,
      priority: visits.priority,
      note: notes.note,
    })
    .from(visits)
    .leftJoin(latestNotePerVisit, eq(latestNotePerVisit.visitId, visits.id))
    .leftJoin(
      notes,
      and(
        eq(notes.visitId, visits.id),
        eq(notes.createdAt, latestNotePerVisit.latestCreatedAt)
      )
    )
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.createdAt))
    .limit(limit);

  return visitRows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    appointmentType: row.appointmentType,
    priority: row.priority,
    note: row.note,
  }));
}

