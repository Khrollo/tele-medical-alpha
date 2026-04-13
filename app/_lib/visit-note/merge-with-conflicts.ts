import { type VisitNote, createEmptyVisitNote, parseVisitNote } from "./schema";

interface MergeVisitNoteOptions {
  lockedPaths?: Set<string>;
}

/**
 * Merge AI-parsed note into existing note
 * Most recent AI values take precedence unless a field is already locked by manual edits.
 */
export function mergeVisitNote(
  existing: VisitNote,
  aiParsed: Partial<VisitNote>,
  options: MergeVisitNoteOptions = {}
): VisitNote {
  const merged = { ...existing };
  const lockedPaths = options.lockedPaths ?? new Set<string>();

  // Helper to check if a value is "meaningful" (non-empty)
  const isMeaningful = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "boolean") return true;
    if (typeof value === "number") return true;
    return false;
  };

  // Helper to merge with precedence to new (AI) values
  const mergeValue = <T>(path: string, existingValue: T, newValue: T): T => {
    if (lockedPaths.has(path)) {
      return existingValue;
    }
    // If new value is meaningful, use it (most recent takes precedence)
    if (isMeaningful(newValue)) {
      return newValue;
    }
    // Otherwise keep existing
    return existingValue;
  };

  // Merge subjective
  if (aiParsed.subjective && typeof aiParsed.subjective === "object") {
    const existingSubjective =
      existing.subjective || createEmptyVisitNote().subjective;
    merged.subjective = {
      chiefComplaint: mergeValue(
        "subjective.chiefComplaint",
        existingSubjective.chiefComplaint,
        aiParsed.subjective.chiefComplaint
      ),
      hpi: mergeValue(
        "subjective.hpi",
        existingSubjective.hpi,
        aiParsed.subjective.hpi
      ),
    };
  }

  // Merge objective
  if (aiParsed.objective && typeof aiParsed.objective === "object") {
    const existingObjective =
      existing.objective || createEmptyVisitNote().objective;
    const emptyObjective = createEmptyVisitNote().objective;
    
    // Handle examFindings specially if it's an object
    let mergedExamFindings = existingObjective.examFindings || emptyObjective.examFindings;
    if (aiParsed.objective.examFindings) {
      if (typeof aiParsed.objective.examFindings === "object" && !Array.isArray(aiParsed.objective.examFindings)) {
        // New structured format
        const existingExamFindings = typeof existingObjective.examFindings === "object" && !Array.isArray(existingObjective.examFindings)
          ? existingObjective.examFindings
          : emptyObjective.examFindings;
        mergedExamFindings = {
          general: mergeValue("objective.examFindings.general", existingExamFindings.general, aiParsed.objective.examFindings.general),
          heent: mergeValue("objective.examFindings.heent", existingExamFindings.heent, aiParsed.objective.examFindings.heent),
          neck: mergeValue("objective.examFindings.neck", existingExamFindings.neck, aiParsed.objective.examFindings.neck),
          cardiovascular: mergeValue("objective.examFindings.cardiovascular", existingExamFindings.cardiovascular, aiParsed.objective.examFindings.cardiovascular),
          lungs: mergeValue("objective.examFindings.lungs", existingExamFindings.lungs, aiParsed.objective.examFindings.lungs),
          abdomen: mergeValue("objective.examFindings.abdomen", existingExamFindings.abdomen, aiParsed.objective.examFindings.abdomen),
          musculoskeletal: mergeValue("objective.examFindings.musculoskeletal", existingExamFindings.musculoskeletal, aiParsed.objective.examFindings.musculoskeletal),
          neurologic: mergeValue("objective.examFindings.neurologic", existingExamFindings.neurologic, aiParsed.objective.examFindings.neurologic),
          skin: mergeValue("objective.examFindings.skin", existingExamFindings.skin, aiParsed.objective.examFindings.skin),
          psychological: mergeValue("objective.examFindings.psychological", existingExamFindings.psychological, aiParsed.objective.examFindings.psychological),
        };
      } else if (typeof aiParsed.objective.examFindings === "string") {
        // Backward compatibility: if AI returns a string, keep existing structured format or convert
        mergedExamFindings = typeof existingObjective.examFindings === "object" && !Array.isArray(existingObjective.examFindings)
          ? existingObjective.examFindings
          : { ...emptyObjective.examFindings, general: aiParsed.objective.examFindings };
      }
    }
    
    merged.objective = {
      ...existingObjective,
      ...Object.fromEntries(
        Object.entries(aiParsed.objective)
          .filter(([key]) => key !== "examFindings")
          .map(([key, value]) => {
            const existingValue = existingObjective[key as keyof typeof existingObjective];
            return [key, mergeValue(`objective.${key}`, existingValue, value)];
          })
      ),
      examFindings: mergedExamFindings,
    };
  }

  // Merge pointOfCare
  if (aiParsed.pointOfCare && typeof aiParsed.pointOfCare === "object") {
    const existingPointOfCare =
      existing.pointOfCare || createEmptyVisitNote().pointOfCare;
    const emptyPointOfCare = createEmptyVisitNote().pointOfCare;
    
    // Merge diabetes subsection
    let mergedDiabetes = existingPointOfCare.diabetes || emptyPointOfCare.diabetes;
    if (aiParsed.pointOfCare.diabetes && typeof aiParsed.pointOfCare.diabetes === "object") {
      mergedDiabetes = {
        ...mergedDiabetes,
        ...Object.fromEntries(
          Object.entries(aiParsed.pointOfCare.diabetes).map(([key, value]) => {
            const existingValue = mergedDiabetes[key as keyof typeof mergedDiabetes];
            return [key, mergeValue(`pointOfCare.diabetes.${key}`, existingValue, value)];
          })
        ),
      };
    }

    // Merge HIV
    const mergedHiv = aiParsed.pointOfCare.hiv !== undefined
      ? mergeValue("pointOfCare.hiv", existingPointOfCare.hiv, aiParsed.pointOfCare.hiv)
      : (existingPointOfCare.hiv || "");

    // Merge syphilis
    let mergedSyphilis = existingPointOfCare.syphilis || emptyPointOfCare.syphilis;
    if (aiParsed.pointOfCare.syphilis && typeof aiParsed.pointOfCare.syphilis === "object") {
      mergedSyphilis = {
        result: mergeValue("pointOfCare.syphilis.result", mergedSyphilis.result, aiParsed.pointOfCare.syphilis.result),
        reactivity: mergeValue("pointOfCare.syphilis.reactivity", mergedSyphilis.reactivity, aiParsed.pointOfCare.syphilis.reactivity),
      };
    }

    // Combine all merged subsections
    merged.pointOfCare = {
      diabetes: mergedDiabetes,
      hiv: mergedHiv,
      syphilis: mergedSyphilis,
    };
  }

  // Merge medications - append new medications to existing array
  if (aiParsed.medications && Array.isArray(aiParsed.medications)) {
    const existingMedications = existing.medications || [];
    merged.medications = [...existingMedications, ...aiParsed.medications];
  }

  // Merge assessmentPlan - handle both old format (object) and new format (array)
  if (aiParsed.assessmentPlan) {
    const existingAssessmentPlan = existing.assessmentPlan || createEmptyVisitNote().assessmentPlan;
    const emptyAssessmentPlan = createEmptyVisitNote().assessmentPlan;
    
    if (Array.isArray(aiParsed.assessmentPlan)) {
      // New format: array of assessment-plan pairs
      const existingArray = Array.isArray(existingAssessmentPlan) ? existingAssessmentPlan : [];
      // Append new entries from AI
      merged.assessmentPlan = [...existingArray, ...aiParsed.assessmentPlan];
    } else {
      // Old format: object with assessment/plan, or migration case
      // Use type assertion since we're handling legacy data that might be in old format
      const oldFormat = aiParsed.assessmentPlan as Record<string, unknown>;
      if (oldFormat && typeof oldFormat === "object" && ("assessment" in oldFormat || "plan" in oldFormat)) {
        // Convert old format to new array format
        // Ensure existing array entries have all required properties
        const existingArray = Array.isArray(existingAssessmentPlan) 
          ? existingAssessmentPlan.map(entry => ({
              assessment: entry.assessment || "",
              plan: entry.plan || "",
              medications: entry.medications || [],
              orders: entry.orders || [],
              followUp: entry.followUp || "",
              education: entry.education || "",
              coordination: entry.coordination || "",
            }))
          : (existingAssessmentPlan && typeof existingAssessmentPlan === "object" && "assessment" in existingAssessmentPlan
              ? [{
                  assessment: String((existingAssessmentPlan as Record<string, unknown>).assessment || ""),
                  plan: String((existingAssessmentPlan as Record<string, unknown>).plan || ""),
                  medications: (((existingAssessmentPlan as Record<string, unknown>).medications as VisitNote["assessmentPlan"][number]["medications"]) || []),
                  orders: (((existingAssessmentPlan as Record<string, unknown>).orders as VisitNote["assessmentPlan"][number]["orders"]) || []),
                  followUp: String((existingAssessmentPlan as Record<string, unknown>).followUp || ""),
                  education: String((existingAssessmentPlan as Record<string, unknown>).education || ""),
                  coordination: String((existingAssessmentPlan as Record<string, unknown>).coordination || ""),
                }]
              : []);
        
        const newEntry = {
          assessment: String(oldFormat.assessment || ""),
          plan: String(oldFormat.plan || ""),
          medications: (oldFormat.medications as VisitNote["assessmentPlan"][number]["medications"]) || [],
          orders: (oldFormat.orders as VisitNote["assessmentPlan"][number]["orders"]) || [],
          followUp: String(oldFormat.followUp || ""),
          education: String(oldFormat.education || ""),
          coordination: String(oldFormat.coordination || ""),
        };
        
        // Only add if it has content
        if (newEntry.assessment || newEntry.plan) {
          merged.assessmentPlan = [...existingArray, newEntry];
        } else {
          merged.assessmentPlan = existingArray;
        }
      } else {
        merged.assessmentPlan = Array.isArray(existingAssessmentPlan) ? existingAssessmentPlan : emptyAssessmentPlan;
      }
    }
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
          return [key, mergeValue(`riskFlags.${key}`, existingValue, value)];
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

