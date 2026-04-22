import { inArray, desc } from "drizzle-orm";
import { db } from "../index";
import { patients, visits, notes } from "../schema";
import type { VisitNote } from "@/app/_lib/visit-note/schema";
import {
  tallyOrdersForWorkflow,
  type WorkflowFlags,
} from "@/app/_lib/utils/patient-workflow-chips";

export async function getWorkflowFlagsForPatients(
  patientIds: string[],
): Promise<Map<string, WorkflowFlags>> {
  const result = new Map<string, WorkflowFlags>();
  if (patientIds.length === 0) return result;

  const patientRows = await db
    .select({ id: patients.id, vitals: patients.vitals })
    .from(patients)
    .where(inArray(patients.id, patientIds));

  const vitalsByPatient = new Map<string, boolean>();
  for (const row of patientRows) {
    vitalsByPatient.set(row.id, Array.isArray(row.vitals) && row.vitals.length > 0);
  }

  const visitRows = await db
    .select({ id: visits.id, patientId: visits.patientId })
    .from(visits)
    .where(inArray(visits.patientId, patientIds))
    .orderBy(desc(visits.createdAt));

  const visitToPatient = new Map<string, string>();
  for (const row of visitRows) visitToPatient.set(row.id, row.patientId);

  const visitIds = Array.from(visitToPatient.keys());
  const noteRows =
    visitIds.length > 0
      ? await db
          .select({ visitId: notes.visitId, note: notes.note })
          .from(notes)
          .where(inArray(notes.visitId, visitIds))
      : [];

  const ordersByPatient = new Map<
    string,
    Array<{ type: string; status: string }>
  >();
  for (const row of noteRows) {
    if (!row.note || typeof row.note !== "object") continue;
    const visitNote = row.note as VisitNote;
    if (!Array.isArray(visitNote.orders)) continue;
    const patientId = visitToPatient.get(row.visitId);
    if (!patientId) continue;
    const list = ordersByPatient.get(patientId) ?? [];
    for (const order of visitNote.orders) {
      list.push({ type: order.type ?? "", status: order.status ?? "" });
    }
    ordersByPatient.set(patientId, list);
  }

  for (const patientId of patientIds) {
    const tally = tallyOrdersForWorkflow(ordersByPatient.get(patientId) ?? []);
    result.set(patientId, {
      vitalsRecorded: vitalsByPatient.get(patientId) ?? false,
      ...tally,
    });
  }

  return result;
}
