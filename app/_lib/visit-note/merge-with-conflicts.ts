import { type VisitNote, createEmptyVisitNote, parseVisitNote } from "./schema";

/**
 * Merge AI-parsed note into existing note
 * Most recent (AI) values always take precedence - no conflict detection
 */
export function mergeVisitNote(existing: VisitNote, aiParsed: Partial<VisitNote>): VisitNote {
  const merged = { ...existing };

  // Helper to check if a value is "meaningful" (non-empty)
  const isMeaningful = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "boolean") return true;
    if (typeof value === "number") return true;
    return false;
  };

  // Helper to merge with precedence to new (AI) values
  const mergeValue = (existingValue: any, newValue: any): any => {
    // If new value is meaningful, use it (most recent takes precedence)
    if (isMeaningful(newValue)) {
      return newValue;
    }
    // Otherwise keep existing
    return existingValue || "";
  };

  // Merge subjective
  if (aiParsed.subjective && typeof aiParsed.subjective === "object") {
    const existingSubjective =
      existing.subjective || createEmptyVisitNote().subjective;
    merged.subjective = {
      chiefComplaint: mergeValue(
        existingSubjective.chiefComplaint,
        aiParsed.subjective.chiefComplaint
      ),
      hpi: mergeValue(
        existingSubjective.hpi,
        aiParsed.subjective.hpi
      ),
    };
  }

  // Merge objective
  if (aiParsed.objective && typeof aiParsed.objective === "object") {
    const existingObjective =
      existing.objective || createEmptyVisitNote().objective;
    merged.objective = {
      ...existingObjective,
      ...Object.fromEntries(
        Object.entries(aiParsed.objective).map(([key, value]) => {
          const existingValue = existingObjective[key as keyof typeof existingObjective];
          return [key, mergeValue(existingValue, value)];
        })
      ),
    };
  }

  // Merge diabetes
  if (aiParsed.diabetes && typeof aiParsed.diabetes === "object") {
    const existingDiabetes =
      existing.diabetes || createEmptyVisitNote().diabetes;
    merged.diabetes = {
      ...existingDiabetes,
      ...Object.fromEntries(
        Object.entries(aiParsed.diabetes).map(([key, value]) => {
          const existingValue = existingDiabetes[key as keyof typeof existingDiabetes];
          return [key, mergeValue(existingValue, value)];
        })
      ),
    };
  }

  // Merge medications - append new medications to existing array
  if (aiParsed.medications && Array.isArray(aiParsed.medications)) {
    const existingMedications = existing.medications || [];
    merged.medications = [...existingMedications, ...aiParsed.medications];
  }

  // Merge assessmentPlan
  if (aiParsed.assessmentPlan && typeof aiParsed.assessmentPlan === "object") {
    const existingAssessmentPlan =
      existing.assessmentPlan || createEmptyVisitNote().assessmentPlan;
    merged.assessmentPlan = {
      assessment: mergeValue(
        existingAssessmentPlan.assessment,
        aiParsed.assessmentPlan.assessment
      ),
      plan: mergeValue(
        existingAssessmentPlan.plan,
        aiParsed.assessmentPlan.plan
      ),
    };
  }

  // Append arrays (new items are added, but we could deduplicate if needed)
  const emptyNote = createEmptyVisitNote();
  if (aiParsed.vaccines && aiParsed.vaccines.length > 0) {
    merged.vaccines = [
      ...(existing.vaccines || emptyNote.vaccines),
      ...aiParsed.vaccines,
    ];
  }
  if (aiParsed.familyHistory && aiParsed.familyHistory.length > 0) {
    merged.familyHistory = [
      ...(existing.familyHistory || emptyNote.familyHistory),
      ...aiParsed.familyHistory,
    ];
  }
  if (aiParsed.surgicalHistory && aiParsed.surgicalHistory.length > 0) {
    merged.surgicalHistory = [
      ...(existing.surgicalHistory || emptyNote.surgicalHistory),
      ...aiParsed.surgicalHistory,
    ];
  }
  if (aiParsed.pastMedicalHistory && aiParsed.pastMedicalHistory.length > 0) {
    merged.pastMedicalHistory = [
      ...(existing.pastMedicalHistory || emptyNote.pastMedicalHistory),
      ...aiParsed.pastMedicalHistory,
    ];
  }
  if (aiParsed.orders && aiParsed.orders.length > 0) {
    merged.orders = [
      ...(existing.orders || emptyNote.orders),
      ...aiParsed.orders,
    ];
  }

  // Merge riskFlags
  if (aiParsed.riskFlags && typeof aiParsed.riskFlags === "object") {
    const existingRiskFlags =
      existing.riskFlags || createEmptyVisitNote().riskFlags;
    merged.riskFlags = {
      ...existingRiskFlags,
      ...Object.fromEntries(
        Object.entries(aiParsed.riskFlags).map(([key, value]) => {
          const existingValue = existingRiskFlags[key as keyof typeof existingRiskFlags];
          return [key, mergeValue(existingValue, value)];
        })
      ),
    };
  }

  // Merge metadata
  if (aiParsed.transcript) merged.transcript = aiParsed.transcript;
  if (aiParsed.audioPath) merged.audioPath = aiParsed.audioPath;
  if (aiParsed.aiGeneratedAt) merged.aiGeneratedAt = aiParsed.aiGeneratedAt;

  return parseVisitNote(merged);
}

