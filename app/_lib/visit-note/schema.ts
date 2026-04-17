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
      spo2: z.string().default(""),
      weight: z.string().default(""),
      height: z.string().default(""),
      bmi: z.string().default(""),
      examFindings: z
        .object({
          general: z.string().default(""),
          heent: z.string().default(""),
          neck: z.string().default(""),
          cardiovascular: z.string().default(""),
          lungs: z.string().default(""),
          abdomen: z.string().default(""),
          musculoskeletal: z.string().default(""),
          neurologic: z.string().default(""),
          skin: z.string().default(""),
          psychological: z.string().default(""),
        })
        .default({
          general: "",
          heent: "",
          neck: "",
          cardiovascular: "",
          lungs: "",
          abdomen: "",
          musculoskeletal: "",
          neurologic: "",
          skin: "",
          psychological: "",
        }),
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
      spo2: "",
      weight: "",
      height: "",
      bmi: "",
      examFindings: {
        general: "",
        heent: "",
        neck: "",
        cardiovascular: "",
        lungs: "",
        abdomen: "",
        musculoskeletal: "",
        neurologic: "",
        skin: "",
        psychological: "",
      },
      visionOd: "",
      visionOs: "",
      visionOu: "",
      visionCorrection: "",
      visionBlurry: "",
      visionFloaters: "",
      visionPain: "",
      visionLastExamDate: "",
    }),

  // Review of Systems
  reviewOfSystems: z
    .object({
      constitutional: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      heent: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      cardiovascular: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      respiratory: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      gastrointestinal: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      genitourinary: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      musculoskeletal: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      neurologic: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      psychiatric: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
      skin: z.object({ status: z.string().default("not-reviewed"), notes: z.string().default("") }).default({ status: "not-reviewed", notes: "" }),
    })
    .default({
      constitutional: { status: "not-reviewed", notes: "" },
      heent: { status: "not-reviewed", notes: "" },
      cardiovascular: { status: "not-reviewed", notes: "" },
      respiratory: { status: "not-reviewed", notes: "" },
      gastrointestinal: { status: "not-reviewed", notes: "" },
      genitourinary: { status: "not-reviewed", notes: "" },
      musculoskeletal: { status: "not-reviewed", notes: "" },
      neurologic: { status: "not-reviewed", notes: "" },
      psychiatric: { status: "not-reviewed", notes: "" },
      skin: { status: "not-reviewed", notes: "" },
    }),

  // Point of Care
  pointOfCare: z
    .object({
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
      hiv: z.string().default("Unknown"), // "negative", "positive", or "Unknown"
      syphilis: z
        .object({
          result: z.string().default("Unknown"), // "positive", "negative", or "Unknown"
          reactivity: z.string().default("Unknown"), // "reactive", "non-reactive", or "Unknown"
        })
        .default({
          result: "Unknown",
          reactivity: "Unknown",
        }),
    })
    .default({
      diabetes: {
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
      },
      hiv: "Unknown",
      syphilis: {
        result: "Unknown",
        reactivity: "Unknown",
      },
    }),

  // Medications (array of medication records) - matches patient medications structure
  medications: z
    .array(
      z.object({
        id: z.string().optional(), // Optional for new medications, required when syncing to patient
        brandName: z.string().optional().default(""),
        strength: z.string().optional().default(""),
        form: z.string().optional().default(""),
        dosage: z.string().optional().default(""),
        frequency: z.string().optional().default(""),
        status: z
          .enum(["Active", "Inactive", "Discontinued"])
          .default("Active"),
        notes: z.string().optional().default(""), // Can include linked diagnosis
        createdAt: z.string().optional(),
      })
    )
    .default([]),

  // Assessment & Plan - array of detailed assessment-plan entries
  assessmentPlan: z
    .array(
      z.object({
        assessment: z.string().default(""), // Diagnosis/assessment with ICD-10 (e.g., "Acute Otitis Media – New (H66.90)")
        plan: z.string().default(""),       // Treatment plan summary
        medications: z
          .array(
            z.object({
              brandName: z.string().default(""),
              strength: z.string().default(""),
              form: z.string().default(""),
              dosage: z.string().default(""),
              frequency: z.string().default(""),
            })
          )
          .default([]), // Medications linked to this diagnosis
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
          .default([]), // Orders linked to this diagnosis
        followUp: z.string().default(""), // Follow-up instructions
        education: z.string().default(""), // Patient education provided
        coordination: z.string().default(""), // Care coordination notes
      })
    )
    .default([]),

  differentialDiagnoses: z
    .array(
      z.object({
        diagnosis: z.string().default(""),
        rationale: z.string().default(""),
        source: z.enum(["ai", "manual"]).default("manual"),
      })
    )
    .default([]),

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

  visitActions: z
    .object({
      prescriptions: z.array(z.object({
        medication: z.string().default(""),
        dosage: z.string().default(""),
        instructions: z.string().default(""),
        pharmacy: z.string().default(""),
        frequency: z.string().default(""),
        durationValue: z.string().default(""),
        durationUnit: z.string().default("days"),
        notes: z.string().default(""),
      })).default([]),
      labs: z.array(z.object({
        test: z.string().default(""),
        priority: z.string().default("routine"),
        notes: z.string().default(""),
        urgency: z.string().default("Routine"),
        clinicalIndication: z.string().default(""),
      })).default([]),
      imaging: z.array(z.object({
        study: z.string().default(""),
        priority: z.string().default("routine"),
        notes: z.string().default(""),
        bodyRegion: z.string().default(""),
        urgency: z.string().default("Routine"),
        clinicalIndication: z.string().default(""),
      })).default([]),
      referrals: z.array(z.object({
        specialty: z.string().default(""),
        reason: z.string().default(""),
        urgency: z.string().default("routine"),
        providerName: z.string().default(""),
      })).default([]),
      nextSteps: z.array(z.object({
        task: z.string().default(""),
        owner: z.string().default("care-team"),
        dueBy: z.string().default(""),
      })).default([]),
    })
    .default({
      prescriptions: [],
      labs: [],
      imaging: [],
      referrals: [],
      nextSteps: [],
    }),

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
  coding: z
    .object({
      suggestedIcd10Codes: z.array(z.string()).default([]),
      icd10Codes: z.array(z.string()).default([]),
      suggestedCptCodes: z.array(z.string()).default([]),
      cptCodes: z.array(z.string()).default([]),
      mdmComplexity: z.string().default(""),
      visitDurationMinutes: z.string().default(""),
      codingNotes: z.string().default(""),
    })
    .default({
      suggestedIcd10Codes: [],
      icd10Codes: [],
      suggestedCptCodes: [],
      cptCodes: [],
      mdmComplexity: "",
      visitDurationMinutes: "",
      codingNotes: "",
    }),
  consents: z
    .object({
      aiTranscript: z.boolean().default(false),
      aiTranscriptConfirmedAt: z.string().default(""),
      aiTranscriptConfirmedBy: z.string().default(""),
    })
    .default({
      aiTranscript: false,
      aiTranscriptConfirmedAt: "",
      aiTranscriptConfirmedBy: "",
    }),
  coSign: z
    .object({
      requested: z.boolean().default(false),
      requestedFrom: z.string().default(""),
      requestedFromUserId: z.string().default(""),
      reason: z.string().default(""),
      status: z.string().default("not-requested"),
      requestedAt: z.string().default(""),
    })
    .default({
      requested: false,
      requestedFrom: "",
      requestedFromUserId: "",
      reason: "",
      status: "not-requested",
      requestedAt: "",
    }),
  signOff: z
    .object({
      attestationAccepted: z.boolean().default(false),
      signedBy: z.string().default(""),
      signedAt: z.string().default(""),
      amendmentReason: z.string().default(""),
    })
    .default({
      attestationAccepted: false,
      signedBy: "",
      signedAt: "",
      amendmentReason: "",
    }),
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
 * Migrate old format data to new format
 * Handles backward compatibility for examFindings (string -> object)
 */
function migrateVisitNoteData(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  const migrated = { ...(data as Record<string, unknown>) };

  // Ensure objective exists
  if (!migrated.objective) {
    migrated.objective = {};
  }

  // Migrate examFindings from string to object format
  if (migrated.objective && typeof migrated.objective === "object") {
    const objective = migrated.objective as Record<string, unknown>;
    const examFindings = objective.examFindings;
    
    if (typeof examFindings === "string") {
      // Convert old string format to new object format
      // Put the old string in the "general" category
      migrated.objective = {
        ...objective,
        examFindings: {
          general: examFindings || "",
          heent: "",
          neck: "",
          cardiovascular: "",
          lungs: "",
          abdomen: "",
          musculoskeletal: "",
          neurologic: "",
          skin: "",
        },
      };
    } else {
      const examFindingsRecord =
        examFindings && typeof examFindings === "object"
          ? (examFindings as Record<string, unknown>)
          : null;

      if (examFindingsRecord?.general === undefined) {
        // Ensure examFindings exists and has the correct structure
        migrated.objective = {
          ...objective,
          examFindings: {
            general:
              typeof examFindingsRecord?.general === "string"
                ? examFindingsRecord.general
                : "",
            heent:
              typeof examFindingsRecord?.heent === "string"
                ? examFindingsRecord.heent
                : "",
            neck:
              typeof examFindingsRecord?.neck === "string"
                ? examFindingsRecord.neck
                : "",
            cardiovascular:
              typeof examFindingsRecord?.cardiovascular === "string"
                ? examFindingsRecord.cardiovascular
                : "",
            lungs:
              typeof examFindingsRecord?.lungs === "string"
                ? examFindingsRecord.lungs
                : "",
            abdomen:
              typeof examFindingsRecord?.abdomen === "string"
                ? examFindingsRecord.abdomen
                : "",
            musculoskeletal:
              typeof examFindingsRecord?.musculoskeletal === "string"
                ? examFindingsRecord.musculoskeletal
                : "",
            neurologic:
              typeof examFindingsRecord?.neurologic === "string"
                ? examFindingsRecord.neurologic
                : "",
            skin:
              typeof examFindingsRecord?.skin === "string"
                ? examFindingsRecord.skin
                : "",
            psychological:
              typeof examFindingsRecord?.psychological === "string"
                ? examFindingsRecord.psychological
                : "",
          },
        };
      }
    }
  }

  // Migrate assessmentPlan from old format (object) to new format (array)
  if (migrated.assessmentPlan) {
    if (typeof migrated.assessmentPlan === "object" && !Array.isArray(migrated.assessmentPlan)) {
      // Old format: object with assessment/plan
      if ("assessment" in migrated.assessmentPlan || "plan" in migrated.assessmentPlan) {
        const old = migrated.assessmentPlan as { assessment?: string; plan?: string };
        if (old.assessment || old.plan) {
          migrated.assessmentPlan = [{ 
            assessment: old.assessment || "", 
            plan: old.plan || "",
            medications: [],
            orders: [],
            followUp: "",
            education: "",
            coordination: "",
          }];
        } else {
          migrated.assessmentPlan = [];
        }
      }
    } else if (Array.isArray(migrated.assessmentPlan)) {
      // Ensure all entries have the new structure
      migrated.assessmentPlan = migrated.assessmentPlan.map((entry) => {
        const record =
          entry && typeof entry === "object"
            ? (entry as Record<string, unknown>)
            : {};

        return {
          assessment: typeof record.assessment === "string" ? record.assessment : "",
          plan: typeof record.plan === "string" ? record.plan : "",
          medications: Array.isArray(record.medications) ? record.medications : [],
          orders: Array.isArray(record.orders) ? record.orders : [],
          followUp: typeof record.followUp === "string" ? record.followUp : "",
          education: typeof record.education === "string" ? record.education : "",
          coordination:
            typeof record.coordination === "string" ? record.coordination : "",
        };
      });
    }
  } else {
    migrated.assessmentPlan = [];
  }

  return migrated;
}

/**
 * Validate and parse a visit note (from AI or user input)
 * Returns the parsed note or throws if invalid
 */
export function parseVisitNote(data: unknown): VisitNote {
  const migrated = migrateVisitNoteData(data);
  return visitNoteSchema.parse(migrated);
}
