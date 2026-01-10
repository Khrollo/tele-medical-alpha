import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import { db } from "../index";
import { visits, patients } from "../schema";

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
}

