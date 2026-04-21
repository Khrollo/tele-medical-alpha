import Anthropic from "@anthropic-ai/sdk";
import { parseVisitNote, type VisitNote } from "@/app/_lib/visit-note/schema";

/**
 * Coerce known shape drifts from the model into the schema's expected form.
 * The model occasionally emits arrays where the schema wants a string, or
 * lowercase/empty values where the schema wants an enum. We repair these at
 * the boundary so one bad field doesn't drop an otherwise useful parse.
 */
function coerceDelta(raw: unknown): unknown {
    if (!raw || typeof raw !== "object") return raw;
    const obj = raw as Record<string, unknown>;

    // medications[].status must be enum "Active" | "Inactive" | "Discontinued".
    if (Array.isArray(obj.medications)) {
        const validStatus = new Set(["Active", "Inactive", "Discontinued"]);
        obj.medications = obj.medications.map((m) => {
            if (!m || typeof m !== "object") return m;
            const med = { ...(m as Record<string, unknown>) };
            const s = typeof med.status === "string" ? med.status.trim() : "";
            if (!s || !validStatus.has(s)) {
                // Title-case common variants, else default to "Active".
                const title = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                med.status = validStatus.has(title) ? title : "Active";
            }
            return med;
        });
    }

    // familyHistory[].conditions must be a string, not an array.
    if (Array.isArray(obj.familyHistory)) {
        obj.familyHistory = obj.familyHistory.map((f) => {
            if (!f || typeof f !== "object") return f;
            const entry = { ...(f as Record<string, unknown>) };
            if (Array.isArray(entry.conditions)) {
                entry.conditions = entry.conditions
                    .map((c) => (typeof c === "string" ? c : String(c ?? "")))
                    .filter(Boolean)
                    .join(", ");
            }
            return entry;
        });
    }

    // Strip top-level "allergies" — not in the VisitNote schema.
    if ("allergies" in obj) {
        delete obj.allergies;
    }

    // assessmentPlan[].medications[].status has the same enum.
    if (Array.isArray(obj.assessmentPlan)) {
        const validStatus = new Set(["Active", "Inactive", "Discontinued"]);
        obj.assessmentPlan = obj.assessmentPlan.map((entry) => {
            if (!entry || typeof entry !== "object") return entry;
            const a = { ...(entry as Record<string, unknown>) };
            if (Array.isArray(a.medications)) {
                a.medications = a.medications.map((m) => {
                    if (!m || typeof m !== "object") return m;
                    const med = { ...(m as Record<string, unknown>) };
                    const s = typeof med.status === "string" ? med.status.trim() : "";
                    if (s && !validStatus.has(s)) {
                        const title = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
                        med.status = validStatus.has(title) ? title : "Active";
                    }
                    return med;
                });
            }
            return a;
        });
    }

    return obj;
}

/**
 * Try to validate the delta. If Zod rejects it, strip the offending paths
 * and retry so a single malformed field doesn't blow away an otherwise
 * useful diff.
 */
function safeValidateDelta(delta: unknown): VisitNote {
    try {
        return parseVisitNote(delta);
    } catch (err) {
        // Second pass: strip problematic top-level sections and retry.
        const cloned =
            delta && typeof delta === "object"
                ? { ...(delta as Record<string, unknown>) }
                : {};
        const message = err instanceof Error ? err.message : String(err);
        // The Zod error message includes field paths like `medications, 0, status`.
        // Drop any top-level section mentioned so the rest can still be parsed.
        const sections = [
            "medications",
            "familyHistory",
            "surgicalHistory",
            "pastMedicalHistory",
            "vaccines",
            "assessmentPlan",
            "orders",
            "pointOfCare",
            "riskFlags",
        ];
        for (const s of sections) {
            if (message.includes(`"${s}"`)) delete cloned[s];
        }
        try {
            return parseVisitNote(cloned);
        } catch {
            // Last resort: validate an empty object so the caller can still merge.
            return parseVisitNote({});
        }
    }
}

export interface AnthropicParseOptions {
    newSegments: string[];
    runningNote?: Partial<VisitNote>;
    fallbackFullTranscript?: string;
    patientContext?: {
        allergies?: unknown[];
        meds?: unknown[];
        pmh?: unknown[];
    };
}

export interface AnthropicParseResult {
    delta: Partial<VisitNote>;
    parsed: VisitNote;
    cacheHit: boolean;
    latencyMs: number;
    tokens?: {
        input?: number;
        output?: number;
        cachedInput?: number;
        cacheCreation?: number;
    };
}

// Pulled out into a stable constant so the prompt-caching prefix bytes match
// across every request. Any interpolation here (date, patient id, etc.) would
// invalidate the cache on every call — keep everything volatile out of this
// string and put it in the user message instead.
const SYSTEM_PROMPT = `You are a real-time medical scribe that extracts structured visit-note data from a live transcript.

OUTPUT FORMAT:
- Respond with ONLY a valid JSON object. No markdown fences, no commentary, no code blocks.
- Omit fields for which you have no new information — do NOT include empty strings as placeholders.
- Return only fields that have CHANGED or been NEWLY extracted compared to the running state. Unchanged fields must be omitted.
- If nothing new can be extracted, return an empty object: {}.

VISITNOTE SHAPE (all fields optional in the diff — include only fields you have data for):
{
  "subjective": { "chiefComplaint": string, "hpi": string },
  "objective": {
    "bp": string, "hr": string, "temp": string, "spo2": string,
    "weight": string, "height": string, "bmi": string,
    "examFindings": {
      "general": string, "heent": string, "neck": string,
      "cardiovascular": string, "lungs": string, "abdomen": string,
      "musculoskeletal": string, "neurologic": string, "skin": string,
      "psychological": string
    }
  },
  "pointOfCare": {
    "diabetes": { "fastingGlucose": string, "hbA1cValue": string, "hbA1cDate": string, "selfMonitoring": string },
    "hiv": "positive" | "negative",
    "syphilis": { "result": string, "reactivity": string }
  },
  "medications": [{
    "brandName": string, "strength": string, "form": string,
    "dosage": string, "frequency": string,
    "status": "Active" | "Inactive" | "Discontinued",   // MUST be one of these exact strings; default "Active"
    "notes": string
  }],
  "familyHistory": [{
    "relationship": string,
    "status": string,
    "conditions": string                                // COMMA-SEPARATED STRING (e.g. "diabetes, hypertension"), NOT an array
  }],
  "surgicalHistory": [{ "procedure": string, "date": string, "site": string, "surgeon": string, "outcome": string }],
  "pastMedicalHistory": [{ "condition": string, "diagnosedDate": string }],
  "vaccines": [{ "name": string, "date": string, "dose": string, "site": string, "route": string, "lotNumber": string, "manufacturer": string }],
  "assessmentPlan": [{ "assessment": string, "plan": string, "medications": [...], "orders": [...], "followUp": string, "education": string, "coordination": string }],
  "orders": [{ "type": string, "priority": string, "details": string, "status": string, "dateOrdered": string }],
  "riskFlags": { "tobaccoUse": string, "tobaccoAmount": string, "alcoholUse": string, "alcoholFrequency": string, "housingStatus": string, "occupation": string }
}

CRITICAL SHAPE RULES (do not deviate):
- medications[].status MUST be exactly one of "Active", "Inactive", or "Discontinued" (capitalized). If unsure, use "Active".
- familyHistory[].conditions MUST be a single string (join multiple with commas). Never emit it as an array.
- Do NOT emit a top-level "allergies" field — allergies live on the patient record, not the visit note. Omit it entirely.

EXTRACTION RULES:
1. Be literal. Extract only what is explicitly stated. Never fabricate.
2. Chief complaint → short phrase (e.g. "chest pain", "cough").
3. HPI → narrative from the patient's own words.
4. Vitals (BP, HR, temp, SpO2, weight, height, BMI) → string values.
5. Physical exam findings → per-system strings.
6. Medications → one array entry per medication with full details.
7. Allergies → array of {name, reaction?, severity?}.
8. Family history → array of {relationship, conditions[], status}.
9. Surgical history → array of {procedure, date, site, surgeon, outcome}.
10. Past medical history → array of {condition, diagnosedDate}.
11. Vaccines → array of {name, date, dose, site, route, lotNumber, manufacturer}.
12. Point of care:
    - Diabetes: pointOfCare.diabetes fields.
    - HIV: "positive" | "negative".
    - Syphilis: {result, reactivity}.
13. Assessment & plan → array entries with assessment, plan, medications?, orders?, followUp?, education?, coordination?.
14. Orders → array of {type, priority, details, status, dateOrdered}.

UNITS:
- Weight in POUNDS (numeric string).
- Height in CENTIMETERS (numeric string). Convert feet/inches.
- Temperature in °F.

DATES:
- Convert all relative dates to YYYY-MM-DD using the CURRENT_DATE provided in the user prompt.

SPEAKER CUES:
- "Doctor:"/"Dr.:"/"Clinician:" → spoken by the clinician.
- "Patient:"/"Pt:" → spoken by the patient.
- Extract facts regardless of speaker.

Return ONLY the diff JSON object — nothing else.`;

function summarizeRunningNote(note?: Partial<VisitNote>): string {
    if (!note) return "{}";
    const compact: Record<string, unknown> = {};
    const copy = JSON.parse(JSON.stringify(note)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(copy)) {
        if (v === null || v === undefined) continue;
        if (typeof v === "string" && !v.trim()) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        if (typeof v === "object" && v && Object.keys(v).length === 0) continue;
        compact[k] = v;
    }
    const str = JSON.stringify(compact);
    return str.length > 8000 ? `${str.slice(0, 8000)}...` : str;
}

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
    if (cachedClient) return cachedClient;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }
    cachedClient = new Anthropic({ apiKey });
    return cachedClient;
}

export async function parseVisitNoteAnthropic(
    options: AnthropicParseOptions
): Promise<AnthropicParseResult> {
    const { newSegments, runningNote, patientContext, fallbackFullTranscript } = options;

    const client = getClient();

    const hasSegments = newSegments && newSegments.length > 0;
    const transcriptBlock = hasSegments
        ? newSegments.join("\n")
        : (fallbackFullTranscript ?? "").trim();

    if (!transcriptBlock) {
        throw new Error("No transcript content to parse");
    }

    const today = new Date();
    const currentDateStr = today.toISOString().split("T")[0];

    const hasPatientContext =
        !!patientContext &&
        ((patientContext.allergies?.length ?? 0) > 0 ||
            (patientContext.meds?.length ?? 0) > 0 ||
            (patientContext.pmh?.length ?? 0) > 0);

    const patientContextText = hasPatientContext
        ? `PATIENT CONTEXT (stable across the session):
- Known allergies: ${JSON.stringify(patientContext!.allergies || [])}
- Current medications: ${JSON.stringify(patientContext!.meds || [])}
- Past medical history: ${JSON.stringify(patientContext!.pmh || [])}`
        : null;

    const userContent = `CURRENT_DATE: ${currentDateStr}

RUNNING_STATE (what the UI already shows — return a DIFF against this):
${summarizeRunningNote(runningNote)}

${hasSegments ? "NEW_TRANSCRIPT_SEGMENTS (new information to extract):" : "FULL_TRANSCRIPT (no delta available, re-parse):"}
${transcriptBlock}

Return a JSON object containing ONLY changed or newly extracted VisitNote fields.`;

    // Build the system array with a cache breakpoint at the end of the
    // stable prompt + patient context. Anything that changes per-request
    // (current date, running state, new segments) goes in the user message
    // AFTER the cached prefix, so we keep the cache warm across parses.
    const systemBlocks: Anthropic.TextBlockParam[] = [
        {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
        },
    ];
    if (patientContextText) {
        systemBlocks.push({
            type: "text",
            text: patientContextText,
            cache_control: { type: "ephemeral" },
        });
    }

    const startedAt = Date.now();

    const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        system: systemBlocks,
        messages: [
            {
                role: "user",
                content: userContent,
            },
        ],
    });

    const latencyMs = Date.now() - startedAt;

    const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const raw = textBlock?.text?.trim() ?? "";
    if (!raw) {
        throw new Error("Anthropic returned empty response");
    }

    let delta: Partial<VisitNote>;
    try {
        delta = JSON.parse(raw) as Partial<VisitNote>;
    } catch {
        // Fallback: pull the first JSON object out of the response in case
        // the model added any commentary despite the instructions.
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start === -1 || end === -1 || end <= start) {
            throw new Error("Could not locate JSON object in model response");
        }
        const extracted = raw
            .slice(start, end + 1)
            .replace(/\/\/[^\n]*/g, "")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/,(\s*[}\]])/g, "$1");
        delta = JSON.parse(extracted) as Partial<VisitNote>;
    }

    // Coerce known shape drifts, then validate defensively. A single bad
    // field (enum mismatch, array-vs-string) used to drop the whole parse;
    // now we repair what we can and strip what we can't.
    const coerced = coerceDelta(delta) as Partial<VisitNote>;
    delta = coerced;
    const parsed = safeValidateDelta(coerced);

    const cachedInput = response.usage.cache_read_input_tokens ?? 0;
    const cacheCreation = response.usage.cache_creation_input_tokens ?? 0;
    const cacheHit = cachedInput > 0;

    return {
        delta,
        parsed,
        cacheHit,
        latencyMs,
        tokens: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            cachedInput,
            cacheCreation,
        },
    };
}

export function isAnthropicConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}
