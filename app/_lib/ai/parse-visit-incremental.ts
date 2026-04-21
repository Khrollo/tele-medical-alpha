import {
    parseVisitNote,
    type VisitNote,
} from "@/app/_lib/visit-note/schema";
import { getOpenRouterTextModel } from "./parse-visit";
import {
    parseVisitNoteAnthropic,
    isAnthropicConfigured,
} from "./parse-visit-anthropic";

export type AiProvider = "anthropic" | "openrouter";

/**
 * Resolve which provider to use for a parse call. Order:
 *  1. `AI_PROVIDER` env var — explicit override (`anthropic` or `openrouter`).
 *  2. `ANTHROPIC_API_KEY` present → anthropic.
 *  3. `OPENROUTER_API_KEY` present → openrouter.
 *  4. Default to anthropic (will surface a clear "missing API key" error).
 */
export function resolveActiveProvider(): AiProvider {
    const explicit = (process.env.AI_PROVIDER || "").toLowerCase();
    if (explicit === "anthropic" || explicit === "openrouter") {
        return explicit;
    }
    if (isAnthropicConfigured()) return "anthropic";
    if (process.env.OPENROUTER_API_KEY) return "openrouter";
    return "anthropic";
}

export interface IncrementalParseOptions {
    /**
     * New transcript segments since the last successful parse. Each segment is a
     * finalized utterance; they are joined with newlines for the model.
     */
    newSegments: string[];
    /**
     * The currently-merged VisitNote the UI is showing. Serialized (trimmed to
     * non-empty fields) and passed as the "running state" so the model can
     * produce a diff instead of re-emitting everything.
     */
    runningNote?: Partial<VisitNote>;
    /** Full transcript up to now — used only when `newSegments` is empty (force parse). */
    fallbackFullTranscript?: string;
    patientContext?: {
        allergies?: unknown[];
        meds?: unknown[];
        pmh?: unknown[];
    };
}

export interface IncrementalParseResult {
    /** Partial VisitNote — only fields the model thinks have changed. */
    delta: Partial<VisitNote>;
    /** Full VisitNote, parsed and validated through the Zod schema. */
    parsed: VisitNote;
    cacheHit: boolean;
    latencyMs: number;
    /** Which upstream produced this result. */
    provider: AiProvider;
    tokens?: {
        input?: number;
        output?: number;
        cachedInput?: number;
    };
}

const SYSTEM_PROMPT = `You are a real-time medical scribe that extracts structured visit-note data from a live transcript.

OUTPUT FORMAT:
- Respond with ONLY a valid JSON object. No markdown, no comments, no explanation text.
- Omit fields you have no new information for — do NOT include empty strings as placeholders.
- When you have information for a field, use the exact shape defined by the VisitNote schema.
- Only return fields where you have CHANGED or NEW information compared to the running state. Unchanged fields must be omitted.

EXTRACTION RULES:
1. Be literal. Only extract what is explicitly stated. Never fabricate.
2. Chief complaint → subjective.chiefComplaint (short phrase).
3. HPI narrative → subjective.hpi (free text).
4. Vitals (BP, HR, temp, SpO2, weight, height, BMI) → objective.* (string values).
5. Physical exam findings → objective.examFindings.{general,heent,neck,cardiovascular,lungs,abdomen,musculoskeletal,neurologic,skin,psychological}.
6. Medications → medications: array of {brandName, strength, form, dosage, frequency, status, notes}.
7. Allergies → allergies: array of {name, reaction?, severity?}.
8. Family history → familyHistory: array of {relationship, conditions, status}.
9. Surgical history → surgicalHistory: array of {procedure, date, site, surgeon, outcome}.
10. Past medical history → pastMedicalHistory: array of {condition, diagnosedDate}.
11. Vaccines → vaccines: array of {name, date, dose, site, route, lotNumber, manufacturer}.
12. Point of care:
    - Diabetes: pointOfCare.diabetes.{fastingGlucose, hbA1cValue, hbA1cDate, selfMonitoring}
    - HIV: pointOfCare.hiv = "positive" | "negative"
    - Syphilis: pointOfCare.syphilis = {result, reactivity}
13. Assessment & plan → assessmentPlan: array of {assessment, plan, medications?, orders?, followUp?, education?, coordination?}.
14. Orders → orders: array of {type, priority, details, status, dateOrdered}.

UNITS:
- Weight in POUNDS (numeric string).
- Height in CENTIMETERS (numeric string). Convert feet/inches.
- Temperature in °F.

DATES:
- Convert all relative dates to YYYY-MM-DD using the CURRENT_DATE provided in the user prompt.
- "a month ago" = CURRENT_DATE minus 1 month.

SPEAKER CUES:
- "Doctor:" / "Dr.:" / "Clinician:" prefix → information spoken BY the clinician (may be repeating patient statement).
- "Patient:" / "Pt:" prefix → information spoken BY the patient.
- Use cues only for context — extract facts regardless of who spoke them.

Return ONLY the diff JSON object.`;

function summarizeRunningNote(note?: Partial<VisitNote>): string {
    if (!note) return "{}";
    // Strip empty fields to keep the running state compact.
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
    // Cap the running-state payload so we don't exceed the uncached portion budget.
    return str.length > 8000 ? `${str.slice(0, 8000)}...` : str;
}

export async function parseVisitNoteIncremental(
    options: IncrementalParseOptions
): Promise<IncrementalParseResult> {
    const provider = resolveActiveProvider();
    if (provider === "anthropic") {
        const result = await parseVisitNoteAnthropic(options);
        return {
            delta: result.delta,
            parsed: result.parsed,
            cacheHit: result.cacheHit,
            latencyMs: result.latencyMs,
            provider: "anthropic",
            tokens: {
                input: result.tokens?.input,
                output: result.tokens?.output,
                cachedInput: result.tokens?.cachedInput,
            },
        };
    }
    return parseVisitNoteIncrementalOpenRouter(options);
}

async function parseVisitNoteIncrementalOpenRouter(
    options: IncrementalParseOptions
): Promise<IncrementalParseResult> {
    const { newSegments, runningNote, patientContext, fallbackFullTranscript } = options;

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
        throw new Error("Missing OPENROUTER_API_KEY environment variable");
    }

    const hasSegments = newSegments && newSegments.length > 0;
    const transcriptBlock = hasSegments
        ? newSegments.join("\n")
        : (fallbackFullTranscript ?? "").trim();

    if (!transcriptBlock) {
        throw new Error("No transcript content to parse");
    }

    const today = new Date();
    const currentDateStr = today.toISOString().split("T")[0];

    const contextBlock =
        patientContext &&
        (patientContext.allergies?.length ||
            patientContext.meds?.length ||
            patientContext.pmh?.length)
            ? `PATIENT CONTEXT (stable across the session):
- Known allergies: ${JSON.stringify(patientContext.allergies || [])}
- Current medications: ${JSON.stringify(patientContext.meds || [])}
- Past medical history: ${JSON.stringify(patientContext.pmh || [])}`
            : "";

    const userContent = `CURRENT_DATE: ${currentDateStr}

RUNNING_STATE (what the UI already shows; merge as context — return a DIFF against this):
${summarizeRunningNote(runningNote)}

${hasSegments ? "NEW_TRANSCRIPT_SEGMENTS (new information to extract):" : "FULL_TRANSCRIPT (no delta available, re-parse):"}
${transcriptBlock}

Return a JSON object containing ONLY changed or newly extracted VisitNote fields.`;

    const messages = [
        {
            role: "system" as const,
            content: [
                {
                    type: "text" as const,
                    text: SYSTEM_PROMPT,
                    cache_control: { type: "ephemeral" as const },
                },
            ],
        },
        ...(contextBlock
            ? [
                  {
                      role: "user" as const,
                      content: [
                          {
                              type: "text" as const,
                              text: contextBlock,
                              cache_control: { type: "ephemeral" as const },
                          },
                      ],
                  },
                  {
                      role: "assistant" as const,
                      content: "Understood — I'll use that patient context.",
                  },
              ]
            : []),
        {
            role: "user" as const,
            content: userContent,
        },
    ];

    const startedAt = Date.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "Tele-Medical Live-Visit",
        },
        body: JSON.stringify({
            model: getOpenRouterTextModel(),
            messages,
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 4000,
            // OpenRouter passes provider metadata through; usage includes
            // prompt_tokens_details.cached_tokens when the upstream model caches.
            usage: { include: true },
        }),
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`
        );
    }

    const result = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_tokens_details?: { cached_tokens?: number };
        };
    };

    const content = result.choices?.[0]?.message?.content || "";
    if (!content) {
        throw new Error("OpenRouter returned empty response");
    }

    let delta: Partial<VisitNote>;
    try {
        delta = JSON.parse(content) as Partial<VisitNote>;
    } catch {
        // Last-ditch extraction: pull out the first {...} block and strip
        // trailing commas and // line-comments. OpenRouter with json_object
        // should rarely need this, but some upstream models still leak markdown.
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start === -1 || end === -1 || end <= start) {
            throw new Error("Could not locate JSON object in model response");
        }
        const extracted = content
            .slice(start, end + 1)
            .replace(/\/\/[^\n]*/g, "")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/,(\s*[}\]])/g, "$1");
        delta = JSON.parse(extracted) as Partial<VisitNote>;
    }

    // Validate through Zod. The delta is partial, so we merge into an empty
    // note just to validate shape — downstream code merges with real state.
    const normalizedDelta = parseVisitNote(delta);

    const inputTokens = result.usage?.prompt_tokens;
    const cachedInput = result.usage?.prompt_tokens_details?.cached_tokens;
    const cacheHit = typeof cachedInput === "number" && cachedInput > 0;

    return {
        delta,
        parsed: normalizedDelta,
        cacheHit,
        latencyMs,
        provider: "openrouter",
        tokens: {
            input: inputTokens,
            output: result.usage?.completion_tokens,
            cachedInput,
        },
    };
}
