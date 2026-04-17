import type { VisitNote } from "@/app/_lib/visit-note/schema";

const ICD_CODE_REGEX = /\b[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?\b/g;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function extractAssessmentCodes(note: VisitNote) {
  const extracted = note.assessmentPlan.flatMap((entry) =>
    Array.from((entry.assessment || "").matchAll(ICD_CODE_REGEX)).map((match) => match[0])
  );

  return unique(extracted);
}

export function getSuggestedIcd10Codes(note: VisitNote) {
  return unique([
    ...extractAssessmentCodes(note),
    ...note.pastMedicalHistory.map((entry) => entry.icd10),
  ]);
}

export function getSuggestedCptCodes(note: VisitNote) {
  if (note.coding.suggestedCptCodes.length > 0) {
    return unique(note.coding.suggestedCptCodes);
  }

  const duration = Number.parseInt(note.coding.visitDurationMinutes || "0", 10);
  const orderCount =
    note.orders.length +
    note.visitActions.labs.length +
    note.visitActions.imaging.length +
    note.visitActions.referrals.length;
  const assessmentCount = note.assessmentPlan.length;
  const mdm = note.coding.mdmComplexity;

  if (mdm === "high" || duration >= 40 || assessmentCount >= 3 || orderCount >= 4) {
    return ["99215"];
  }

  if (mdm === "moderate" || duration >= 30 || assessmentCount >= 2 || orderCount >= 2) {
    return ["99214"];
  }

  return ["99213"];
}

export function enrichCodingSuggestions(note: VisitNote): VisitNote {
  return {
    ...note,
    coding: {
      ...note.coding,
      suggestedIcd10Codes: getSuggestedIcd10Codes(note),
      suggestedCptCodes: getSuggestedCptCodes(note),
    },
  };
}

export function validateNoteForSignOff(note: VisitNote) {
  const errors: string[] = [];

  if (!note.subjective.chiefComplaint.trim()) {
    errors.push("Chief complaint is required before sign-off.");
  }

  if (!note.subjective.hpi.trim()) {
    errors.push("HPI is required before sign-off.");
  }

  const reviewedRosSystems = Object.values(note.reviewOfSystems).filter(
    (entry) => entry.status !== "not-reviewed"
  );
  if (reviewedRosSystems.length === 0) {
    errors.push("Review of systems must be documented before sign-off.");
  }

  const hasVitals =
    Boolean(note.objective.bp.trim()) ||
    Boolean(note.objective.hr.trim()) ||
    Boolean(note.objective.temp.trim());
  const hasExam = Object.values(note.objective.examFindings).some((value) =>
    Boolean(value.trim())
  );
  if (!hasVitals && !hasExam) {
    errors.push("Objective findings or vitals are required before sign-off.");
  }

  if (note.assessmentPlan.length === 0) {
    errors.push("Assessment and plan must contain at least one entry.");
  }

  if (!note.consents.aiTranscript && note.transcript) {
    errors.push("AI transcript consent must be confirmed before using transcript-derived notes.");
  }

  if (note.coding.icd10Codes.length < 1) {
    errors.push("At least one ICD-10 code is required before sign-off.");
  }

  if (note.coding.cptCodes.length < 1) {
    errors.push("At least one CPT code is required before sign-off.");
  }

  if (!note.signOff.attestationAccepted) {
    errors.push("Sign-off attestation must be accepted before closing the visit.");
  }

  return errors;
}
