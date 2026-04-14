import { and, desc, eq, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "../index";
import { documents, notes, patients, transcripts, users, visits } from "../schema";

interface AuditEntryRecord {
  timestamp?: string;
  userName?: string | null;
  action?: string | null;
}

export interface VisitLogEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  actor: string | null;
  summary: string;
  visitId: string;
}

export interface PatientVisitLogVisit {
  id: string;
  createdAt: Date;
  status: string | null;
  notesStatus: string | null;
  priority: string | null;
  appointmentType: string | null;
  clinicianName: string | null;
  summary: string | null;
  transcriptCount: number;
  documentCount: number;
  eventCount: number;
  events: VisitLogEvent[];
}

export interface PatientVisitLogResult {
  patient: {
    id: string;
    fullName: string;
  };
  visits: PatientVisitLogVisit[];
}

function isAuditEntryRecord(value: unknown): value is AuditEntryRecord {
  return !!value && typeof value === "object";
}

function formatAuditAction(action: string | null | undefined) {
  switch ((action || "").toLowerCase()) {
    case "created":
      return "Note created";
    case "finalized":
      return "Visit signed and completed";
    case "edited_after_signing":
      return "Signed note edited";
    case "assigned":
      return "Assigned to clinician";
    case "assign_to_me":
      return "Assigned to me";
    case "waiting":
      return "Moved to schedule";
    case "in_progress":
      return "Moved in progress";
    default:
      return action
        ? action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
        : "Visit updated";
  }
}

function getVisitSummary(note: unknown) {
  if (!note || typeof note !== "object") {
    return null;
  }

  const record = note as Record<string, unknown>;
  const subjective = record.subjective as Record<string, unknown> | undefined;
  const assessmentPlan = Array.isArray(record.assessmentPlan)
    ? (record.assessmentPlan as Array<Record<string, unknown>>)
    : [];

  const chiefComplaint =
    typeof subjective?.chiefComplaint === "string"
      ? subjective.chiefComplaint.trim()
      : "";
  const hpi =
    typeof subjective?.hpi === "string" ? subjective.hpi.trim() : "";
  const assessment =
    typeof assessmentPlan[0]?.assessment === "string"
      ? assessmentPlan[0].assessment.trim()
      : "";

  return chiefComplaint || hpi || assessment || null;
}

export async function getPatientVisitLogs(
  patientId: string
): Promise<PatientVisitLogResult | null> {
  const cacheKey = `visit-log-${patientId}`;

  return unstable_cache(
    async () => {
      const patientResult = await db
        .select({
          id: patients.id,
          fullName: patients.fullName,
        })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);

      const patient = patientResult[0];
      if (!patient) {
        return null;
      }

      const visitRows = await db
        .select({
          id: visits.id,
          createdAt: visits.createdAt,
          status: visits.status,
          notesStatus: visits.notesStatus,
          priority: visits.priority,
          appointmentType: visits.appointmentType,
          clinicianName: users.name,
          clinicianEmail: users.email,
        })
        .from(visits)
        .leftJoin(users, eq(users.id, visits.clinicianId))
        .where(eq(visits.patientId, patientId))
        .orderBy(desc(visits.createdAt));

      if (visitRows.length === 0) {
        return { patient, visits: [] };
      }

      const visitIds = visitRows.map((visit) => visit.id);

      const [noteRows, transcriptRows, documentRows] = await Promise.all([
        db
          .select({
            id: notes.id,
            visitId: notes.visitId,
            note: notes.note,
            audit: notes.audit,
            createdAt: notes.createdAt,
            updatedAt: notes.updatedAt,
            authorName: users.name,
            authorEmail: users.email,
          })
          .from(notes)
          .leftJoin(users, eq(users.id, notes.authorId))
          .where(inArray(notes.visitId, visitIds))
          .orderBy(desc(notes.createdAt)),
        db
          .select({
            id: transcripts.id,
            visitId: transcripts.visitId,
            createdAt: transcripts.createdAt,
          })
          .from(transcripts)
          .where(inArray(transcripts.visitId, visitIds))
          .orderBy(desc(transcripts.createdAt)),
        db
          .select({
            id: documents.id,
            visitId: documents.visitId,
            filename: documents.filename,
            uploadedAt: documents.uploadedAt,
            uploadedByName: users.name,
            uploadedByEmail: users.email,
          })
          .from(documents)
          .leftJoin(users, eq(users.id, documents.uploadedBy))
          .where(and(inArray(documents.visitId, visitIds), eq(documents.patientId, patientId)))
          .orderBy(desc(documents.uploadedAt)),
      ]);

      const notesByVisit = new Map<string, typeof noteRows>();
      const transcriptsByVisit = new Map<string, typeof transcriptRows>();
      const documentsByVisit = new Map<string, typeof documentRows>();

      noteRows.forEach((note) => {
        notesByVisit.set(note.visitId, [...(notesByVisit.get(note.visitId) || []), note]);
      });
      transcriptRows.forEach((transcript) => {
        transcriptsByVisit.set(transcript.visitId, [
          ...(transcriptsByVisit.get(transcript.visitId) || []),
          transcript,
        ]);
      });
      documentRows.forEach((document) => {
        if (!document.visitId) {
          return;
        }
        documentsByVisit.set(document.visitId, [
          ...(documentsByVisit.get(document.visitId) || []),
          document,
        ]);
      });

      const visitsWithEvents = visitRows.map((visit) => {
        const visitNotes = notesByVisit.get(visit.id) || [];
        const visitTranscripts = transcriptsByVisit.get(visit.id) || [];
        const visitDocuments = documentsByVisit.get(visit.id) || [];
        const latestNote = visitNotes[0];

        const events: VisitLogEvent[] = [
          {
            id: `${visit.id}:created`,
            timestamp: visit.createdAt,
            eventType: "visit_created",
            actor: visit.clinicianName || visit.clinicianEmail || null,
            summary: "Visit created",
            visitId: visit.id,
          },
        ];

        visitNotes.forEach((note) => {
          events.push({
            id: `${visit.id}:note-created:${note.id}`,
            timestamp: note.createdAt,
            eventType: "note_created",
            actor: note.authorName || note.authorEmail || null,
            summary: "Clinical note created",
            visitId: visit.id,
          });

          if (note.updatedAt.getTime() !== note.createdAt.getTime()) {
            events.push({
              id: `${visit.id}:note-updated:${note.id}`,
              timestamp: note.updatedAt,
              eventType: "note_updated",
              actor: note.authorName || note.authorEmail || null,
              summary: "Clinical note updated",
              visitId: visit.id,
            });
          }

          const audit = note.audit as { entries?: unknown[] } | null;
          const auditEntries = Array.isArray(audit?.entries) ? audit.entries : [];

          auditEntries.filter(isAuditEntryRecord).forEach((entry, index) => {
            const timestamp = entry.timestamp ? new Date(entry.timestamp) : note.updatedAt;
            if (Number.isNaN(timestamp.getTime())) {
              return;
            }

            events.push({
              id: `${visit.id}:audit:${note.id}:${index}`,
              timestamp,
              eventType: entry.action || "audit",
              actor: entry.userName || null,
              summary: formatAuditAction(entry.action),
              visitId: visit.id,
            });
          });
        });

        visitTranscripts.forEach((transcript) => {
          events.push({
            id: `${visit.id}:transcript:${transcript.id}`,
            timestamp: transcript.createdAt,
            eventType: "transcript_created",
            actor: null,
            summary: "Transcript captured",
            visitId: visit.id,
          });
        });

        visitDocuments.forEach((document) => {
          events.push({
            id: `${visit.id}:document:${document.id}`,
            timestamp: document.uploadedAt,
            eventType: "document_uploaded",
            actor: document.uploadedByName || document.uploadedByEmail || null,
            summary: `Document uploaded: ${document.filename}`,
            visitId: visit.id,
          });
        });

        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return {
          id: visit.id,
          createdAt: visit.createdAt,
          status: visit.status,
          notesStatus: visit.notesStatus,
          priority: visit.priority,
          appointmentType: visit.appointmentType,
          clinicianName: visit.clinicianName || visit.clinicianEmail || null,
          summary: getVisitSummary(latestNote?.note),
          transcriptCount: visitTranscripts.length,
          documentCount: visitDocuments.length,
          eventCount: events.length,
          events,
        };
      });

      return {
        patient,
        visits: visitsWithEvents,
      };
    },
    [cacheKey],
    {
      tags: [`patient:${patientId}`, `visits:${patientId}`],
      revalidate: 60,
    }
  )();
}
