import { z } from "zod";

/**
 * Visit Note Schema - matches the form structure
 * All fields are optional strings/booleans to allow partial data
 */
export const visitNoteSchema = z.object({
  // Subjective
  subjective: z
    .object({
      chiefComplaint: z.string().default(""),
      hpi: z.string().default(""),
    })
    .default({ chiefComplaint: "", hpi: "" }),

  // Objective
  objective: z
    .object({
      bp: z.string().default(""),
      hr: z.string().default(""),
      temp: z.string().default(""),
      weight: z.string().default(""),
      height: z.string().default(""),
      examFindings: z.string().default(""),
      visionOd: z.string().default(""),
      visionOs: z.string().default(""),
      visionOu: z.string().default(""),
      visionCorrection: z.string().default(""),
      visionBlurry: z.string().default(""),
      visionFloaters: z.string().default(""),
      visionPain: z.string().default(""),
      visionLastExamDate: z.string().default(""),
    })
    .default({
      bp: "",
      hr: "",
      temp: "",
      weight: "",
      height: "",
      examFindings: "",
      visionOd: "",
      visionOs: "",
      visionOu: "",
      visionCorrection: "",
      visionBlurry: "",
      visionFloaters: "",
      visionPain: "",
      visionLastExamDate: "",
    }),

  // Diabetes
  diabetes: z
    .object({
      fastingGlucose: z.string().default(""),
      randomGlucose: z.string().default(""),
      hbA1cValue: z.string().default(""),
      hbA1cDate: z.string().default(""),
      homeMonitoring: z.string().default(""),
      averageReadings: z.string().default(""),
      hypoglycemiaEpisodes: z.string().default(""),
      hyperglycemiaSymptoms: z.string().default(""),
      footExam: z.string().default(""),
      eyeExamDue: z.string().default(""),
    })
    .default({
      fastingGlucose: "",
      randomGlucose: "",
      hbA1cValue: "",
      hbA1cDate: "",
      homeMonitoring: "",
      averageReadings: "",
      hypoglycemiaEpisodes: "",
      hyperglycemiaSymptoms: "",
      footExam: "",
      eyeExamDue: "",
    }),

  // Medications (array of medication records) - matches patient medications structure
  medications: z
    .array(
      z.object({
        id: z.string().optional(), // Optional for new medications, required when syncing to patient
        brandName: z.string().optional().default(""),
        genericName: z.string().optional().default(""),
        strength: z.string().optional().default(""),
        form: z.string().optional().default(""),
        dosage: z.string().optional().default(""),
        frequency: z.string().optional().default(""),
        status: z
          .enum(["Active", "Inactive", "Discontinued"])
          .default("Active"),
        notes: z.string().optional().default(""),
        createdAt: z.string().optional(),
      })
    )
    .default([]),

  // Assessment & Plan
  assessmentPlan: z
    .object({
      assessment: z.string().default(""),
      plan: z.string().default(""),
    })
    .default({ assessment: "", plan: "" }),

  // Vaccines (array of vaccine records)
  vaccines: z
    .array(
      z.object({
        name: z.string().default(""),
        date: z.string().default(""),
        dose: z.string().default(""),
        site: z.string().default(""),
        route: z.string().default(""),
        lotNumber: z.string().default(""),
        manufacturer: z.string().default(""),
      })
    )
    .default([]),

  // Family History (array)
  familyHistory: z
    .array(
      z.object({
        relationship: z.string().default(""),
        status: z.string().default(""),
        conditions: z.string().default(""),
      })
    )
    .default([]),

  // Risk Flags
  riskFlags: z
    .object({
      tobaccoUse: z.string().default(""),
      tobaccoAmount: z.string().default(""),
      alcoholUse: z.string().default(""),
      alcoholFrequency: z.string().default(""),
      housingStatus: z.string().default(""),
      occupation: z.string().default(""),
    })
    .default({
      tobaccoUse: "",
      tobaccoAmount: "",
      alcoholUse: "",
      alcoholFrequency: "",
      housingStatus: "",
      occupation: "",
    }),

  // Surgical History (array)
  surgicalHistory: z
    .array(
      z.object({
        procedure: z.string().default(""),
        date: z.string().default(""),
        site: z.string().default(""),
        surgeon: z.string().default(""),
        outcome: z.string().default(""),
        source: z.string().default(""),
      })
    )
    .default([]),

  // Past Medical History (array)
  pastMedicalHistory: z
    .array(
      z.object({
        condition: z.string().default(""),
        status: z.string().default(""),
        diagnosedDate: z.string().default(""),
        impact: z.string().default(""),
        icd10: z.string().default(""),
        source: z.string().default(""),
      })
    )
    .default([]),

  // Orders (array)
  orders: z
    .array(
      z.object({
        type: z.string().default(""),
        priority: z.string().default(""),
        details: z.string().default(""),
        status: z.string().default(""),
        dateOrdered: z.string().default(""),
      })
    )
    .default([]),

  // Documents (array)
  docs: z
    .object({
      uploadedDocuments: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            size: z.number(),
            uploadedAt: z.string(),
            dataUrl: z.string().optional(), // Client preview only, not stored in DB
            storageUrl: z.string().optional(), // Storage path for DB persistence
          })
        )
        .default([]),
    })
    .default({ uploadedDocuments: [] }),

  // Metadata
  transcript: z.string().optional(),
  audioPath: z.string().optional(),
  aiGeneratedAt: z.string().optional(),
});

export type VisitNote = z.infer<typeof visitNoteSchema>;

/**
 * Create an empty visit note with all defaults
 */
export function createEmptyVisitNote(): VisitNote {
  return visitNoteSchema.parse({});
}

/**
 * Validate and parse a visit note (from AI or user input)
 * Returns the parsed note or throws if invalid
 */
export function parseVisitNote(data: unknown): VisitNote {
  return visitNoteSchema.parse(data);
}
