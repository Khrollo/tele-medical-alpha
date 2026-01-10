import { parseVisitNote, type VisitNote } from "@/app/_lib/visit-note/schema";

interface ParseVisitOptions {
  transcript: string;
  prompt?: string;
  patientContext?: {
    allergies?: any[];
    meds?: any[];
    pmh?: any[];
  };
  previousTranscripts?: string[];
}

/**
 * Parse transcript into structured visit note
 * This is the core parsing logic that can be called directly from server code
 * without going through the HTTP API.
 */
export async function parseVisitNoteFromTranscript(
  options: ParseVisitOptions
): Promise<VisitNote> {
  const { transcript, prompt, patientContext, previousTranscripts } = options;

  if (!transcript || typeof transcript !== "string") {
    throw new Error("Missing or invalid transcript");
  }

  const replicateApiKey = process.env.REPLICATE_API_KEY;

  if (!replicateApiKey) {
    throw new Error("Missing REPLICATE_API_KEY environment variable");
  }

  // Build the system prompt with schema
  const systemPrompt = `You are a medical assistant that extracts structured visit note data from transcripts. 
Return ONLY valid JSON matching this exact schema. Never omit required fields - use empty strings, false, or empty arrays for missing data.
Never hallucinate values - if information is not in the transcript, use empty string, false, or empty array.

CRITICAL EXTRACTION RULES:
1. EXTRACT ALL INFORMATION that is explicitly mentioned in the transcript
2. Be thorough - if the transcript mentions "blood pressure of 180/90", extract it as "bp": "180/90"
3. If the transcript mentions "heart rate of 100", extract it as "hr": "100"
4. If the transcript mentions "7 feet tall", convert to cm: 7 * 30.48 = 213.36, extract as "height": "213.36"
5. If the transcript mentions weight, extract as pounds (numeric only, no "lbs" text)
5. If the transcript mentions medications, create an array entry for EACH medication
6. If the transcript mentions conditions, diagnoses, or complaints, extract them to the appropriate fields
7. Extract measurements, vitals, and any numerical values mentioned

UNIT REQUIREMENTS:
- Weight: Always extract as POUNDS (numeric only, no "lbs" text). If given in kg, convert (1 kg = 2.20462 lbs)
- Height: Always extract as CENTIMETERS (numeric only, no "cm" text). Convert from feet/inches if needed:
  * 1 foot = 30.48 cm
  * 1 inch = 2.54 cm
  * Example: "6 feet" = 182.88 cm → "182.88"
  * Example: "5'10\"" = (5*30.48) + (10*2.54) = 152.4 + 25.4 = 177.8 cm → "177.8"
  * Example: "70 inches" = 70*2.54 = 177.8 cm → "177.8"

EXAMPLES:
- Transcript: "Patient is 6 feet tall, weighs 180 pounds, BP 120/80, HR 72" 
  → Extract: height: "182.88", weight: "180", bp: "120/80", hr: "72"
- Transcript: "Patient is 5'10\" and weighs 170 lbs" 
  → Extract: height: "177.8", weight: "170"
- Transcript: "Patient takes Metformin 500mg twice daily" 
  → Extract: medications: [{"name": "Metformin 500mg", "dosage": "twice daily", ...}]
- Transcript: "Patient complains of chest pain" 
  → Extract: subjective.chiefComplaint: "chest pain"

IMPORTANT INSTRUCTIONS:
- Extract ALL information mentioned in the transcript, including medications, vaccines, family history, surgical history, past medical history, and orders
- For medications: Create an array entry for EACH medication mentioned, with name, dosage, and any related information
- For vaccines: Extract each vaccine mentioned with its details (name, date, dose, site, route, lot number, manufacturer)
- For family history: Extract each family member's medical history mentioned
- For surgical history: Extract each surgery/procedure mentioned
- For past medical history: Extract each condition mentioned
- For orders: Extract each order/prescription/test ordered

Schema:
{
  "subjective": { 
    "chiefComplaint": "",  // Primary reason for visit
    "hpi": ""              // History of present illness
  },
  "objective": { 
    "bp": "",              // Blood pressure (e.g., "120/80")
    "hr": "",              // Heart rate (e.g., "72")
    "temp": "",            // Temperature (e.g., "98.6")
    "weight": "",          // Weight in POUNDS - numeric value only, NO unit text (e.g., "170" not "170 lbs")
    "height": "",          // Height in CENTIMETERS - numeric value only, NO unit text (e.g., "178" not "178 cm"). Convert from feet/inches if needed (1 foot = 30.48 cm, 1 inch = 2.54 cm)
    "examFindings": "",    // Physical examination findings
    "visionOd": "",        // Vision right eye
    "visionOs": "",        // Vision left eye
    "visionOu": "",        // Vision both eyes
    "visionCorrection": "", // "With correction" | "Without correction" | ""
    "visionBlurry": "",     // "Yes" | "No" | ""
    "visionFloaters": "",   // "Yes" | "No" | ""
    "visionPain": "",       // "Yes" | "No" | ""
    "visionLastExamDate": "" // YYYY-MM-DD format
  },
  "diabetes": { 
    "fastingGlucose": "",      // Fasting blood glucose
    "randomGlucose": "",       // Random blood glucose
    "hbA1cValue": "",          // HbA1c value (e.g., "7.2")
    "hbA1cDate": "",           // HbA1c date (YYYY-MM-DD)
    "homeMonitoring": "",      // Home glucose monitoring info
    "averageReadings": "",     // Average glucose readings
    "hypoglycemiaEpisodes": "", // Hypoglycemia episodes
    "hyperglycemiaSymptoms": "", // Hyperglycemia symptoms
    "footExam": "",            // Foot exam findings
    "eyeExamDue": ""           // Eye exam due date (YYYY-MM-DD)
  },
  "medications": [  // ARRAY: One entry per medication mentioned
    {
      "name": "",              // Medication name (e.g., "Metformin 500mg")
      "dosage": "",            // Dosage instructions (e.g., "1 tablet twice daily")
      "takingAsPrescribed": false,  // true if patient is taking as prescribed
      "missedDoses": false,    // true if patient missed doses
      "sideEffects": false,    // true if patient reports side effects
      "sideEffectsNotes": ""   // Details about side effects if any
    }
  ],
  "assessmentPlan": { 
    "assessment": "",  // Clinical assessment/diagnosis
    "plan": ""        // Treatment plan
  },
  "vaccines": [  // ARRAY: One entry per vaccine mentioned
    {
      "name": "",        // Vaccine name (e.g., "COVID-19", "Flu")
      "date": "",        // Date given (YYYY-MM-DD)
      "dose": "",        // Dose number (e.g., "1st dose", "Booster")
      "site": "",        // Injection site (e.g., "Left deltoid")
      "route": "",       // Route (e.g., "IM", "Subcutaneous")
      "lotNumber": "",   // Lot number if mentioned
      "manufacturer": "" // Manufacturer if mentioned
    }
  ],
  "familyHistory": [  // ARRAY: One entry per family member mentioned
    {
      "relationship": "",  // Relationship (e.g., "Father", "Mother", "Sibling")
      "status": "",        // Status (e.g., "Alive", "Deceased")
      "conditions": ""     // Medical conditions
    }
  ],
  "riskFlags": { 
    "tobaccoUse": "",         // Tobacco use status (e.g., "Never", "Former", "Current")
    "tobaccoAmount": "",      // Amount if current user (e.g., "1 pack/day")
    "alcoholUse": "",         // Alcohol use status
    "alcoholFrequency": "",   // Frequency (e.g., "Daily", "Weekly", "Occasionally")
    "housingStatus": "",      // Housing status
    "occupation": ""          // Occupation
  },
  "surgicalHistory": [  // ARRAY: One entry per surgery/procedure mentioned
    {
      "procedure": "",    // Procedure name
      "date": "",         // Date (YYYY-MM-DD)
      "site": "",         // Site/location
      "surgeon": "",      // Surgeon name if mentioned
      "outcome": "",      // Outcome/results
      "source": ""        // Source of information
    }
  ],
  "pastMedicalHistory": [  // ARRAY: One entry per condition mentioned
    {
      "condition": "",      // Condition name
      "status": "",         // Status (e.g., "Active", "Resolved", "Chronic")
      "diagnosedDate": "",  // Date diagnosed (YYYY-MM-DD)
      "impact": "",         // Impact on patient
      "icd10": "",          // ICD-10 code if mentioned
      "source": ""          // Source of information
    }
  ],
  "orders": [  // ARRAY: One entry per order/prescription/test mentioned
    {
      "type": "",        // Order type (e.g., "Lab", "Imaging", "Medication", "Referral")
      "priority": "",    // Priority (e.g., "Routine", "Urgent", "STAT")
      "details": "",     // Detailed description of the order
      "status": "",      // Status (e.g., "Ordered", "Pending", "Completed")
      "dateOrdered": ""  // Date ordered (YYYY-MM-DD)
    }
  ]
}`;

  // Build context prompt if patient context provided
  const contextPrompt = patientContext
    ? `\n\nPatient Context:\n- Allergies: ${JSON.stringify(
        patientContext.allergies || []
      )}\n- Current Medications: ${JSON.stringify(
        patientContext.meds || []
      )}\n- Past Medical History: ${JSON.stringify(patientContext.pmh || [])}`
    : "";

  // Build previous transcripts context if provided
  const previousTranscriptsContext =
    previousTranscripts && previousTranscripts.length > 0
      ? `\n\nPrevious Transcripts (for context, but new transcript takes precedence):\n${previousTranscripts
          .map((t: string, i: number) => `Previous Recording ${i + 1}:\n${t}`)
          .join("\n\n")}`
      : "";

  // Use provided prompt or default
  const userPrompt =
    prompt ||
    `Extract structured visit note data from this medical transcript.${contextPrompt}${previousTranscriptsContext}\n\nTranscript:\n${transcript}`;

  // Use provided prompt or default
  const basePrompt =
    prompt ||
    `Parse this medical visit transcript into the structured JSON schema below.${contextPrompt}${previousTranscriptsContext}\n\nIMPORTANT: The NEW transcript below takes precedence over any previous transcripts. Only use previous transcripts for additional context.`;

  // Combine system prompt with user prompt
  // The system prompt contains the schema and instructions
  // The user prompt contains the transcript to parse
  const combinedUserPrompt = `${basePrompt}\n\nNEW Transcript (takes precedence - extract all information from this):\n${transcript}\n\nNow extract all information from the transcript above and populate the JSON schema. Be thorough and extract ALL mentioned information including vitals, measurements, medications, diagnoses, etc.`;

  // DeepSeek on Replicate expects the full prompt including system instructions
  const fullPrompt = `${systemPrompt}\n\n${combinedUserPrompt}`;

  // Parse transcript and generate summary using DeepSeek LLM via Replicate
  const deepSeekModel = "deepseek-ai/deepseek-v3.1";

  const combinedInput = {
    prompt: fullPrompt,
    max_tokens: 8096,
    response_format: "json",
    temperature: 0.2,
  };

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${replicateApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: deepSeekModel, // Replicate will resolve the model version
      input: combinedInput,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${error}`);
  }

  const prediction = await response.json();
  const predictionId = prediction.id;

  // Poll for completion
  let completed = false;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (!completed && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

    const statusResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Token ${replicateApiKey}`,
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error("Failed to check prediction status");
    }

    const status = await statusResponse.json();

    if (status.status === "succeeded") {
      completed = true;
      let content = "";

      // Extract content from output
      const output = status.output;
      if (typeof output === "string") {
        content = output;
      } else if (Array.isArray(output)) {
        content = output.join("");
      } else {
        content = JSON.stringify(output);
      }

      if (!content) {
        throw new Error("Parsing timed out or returned empty result");
      }

      // Parse and validate JSON
      let parsed: unknown;
      try {
        // Try to extract JSON if it's wrapped in markdown code blocks
        const jsonMatch =
          content.match(/```json\s*([\s\S]*?)\s*```/) ||
          content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          parsed = JSON.parse(content);
        }
      } catch (parseError) {
        console.error("Failed to parse JSON:", content);
        throw new Error("Failed to parse JSON from AI response");
      }

      // Validate and return parsed note
      return parseVisitNote(parsed);
    } else if (status.status === "failed" || status.status === "canceled") {
      throw new Error(
        `Parsing failed: ${status.error || "Unknown error"}`
      );
    }

    attempts++;
  }

  throw new Error("Parsing timed out");
}

