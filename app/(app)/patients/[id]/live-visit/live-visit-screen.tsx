"use client";

import * as React from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ChevronRight,
    FileSignature,
    Mic,
    Pause,
    Sparkles,
    Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Avatar, Btn, Pill, type PillTone } from "@/components/ui/clearing";
import {
    parseTranscriptIncrementalAction,
    createVisitDraftAction,
    updateVisitDraftAction,
    finalizeVisitAction,
} from "@/app/_actions/visits";
import { createEmptyVisitNote, type VisitNote } from "@/app/_lib/visit-note/schema";
import { mergeVisitNote } from "@/app/_lib/visit-note/merge-with-conflicts";
import {
    isCalibrationStale,
    loadCalibration,
    type CalibrationResult,
} from "@/app/_lib/audio/calibration";
import { CalibrationModal } from "./calibration-modal";
import { OnboardingHint } from "@/app/_components/onboarding-hint";
import {
    createSrtSimulator,
    fetchSrt,
    type SrtSimulator,
} from "@/app/_lib/ai/srt-simulator";

// ---------- Types ----------

type ParsedFields = {
    cc?: string;
    onset?: string;
    severity?: string;
    radiation?: string;
    trigger?: string;
    assoc?: string;
    fhx?: string;
    allergy?: string;
};

type FieldKey = keyof ParsedFields;

type ChecklistItem = {
    k: string;
    label: string;
    sec: "HPI" | "History" | "Exam" | "Plan";
    awaiting?: boolean;
};

type Flag = { key: string; tone: "critical" | "warn" | "info"; text: string };

// Keys in the order they appear in the vertical timeline (center canvas).
// Keep in sync with TIMELINE_KEYS + the renderer map below.
type TimelineKey =
    | "cc"
    | "onset"
    | "radiation"
    | "trigger"
    | "severity"
    | "assoc"
    | "ros"
    | "allergy"
    | "meds"
    | "fhx"
    | "pmh"
    | "surgical"
    | "social"
    | "exam"
    | "assessment"
    | "plan";

// ---------- Static config ----------

const FIELDS_ORDER: FieldKey[] = [
    "cc",
    "onset",
    "severity",
    "radiation",
    "trigger",
    "assoc",
    "fhx",
    "allergy",
];

const FIELD_META: Record<FieldKey, { label: string; tone: PillTone }> = {
    cc: { label: "Chief complaint", tone: "critical" },
    onset: { label: "Onset", tone: "accent" },
    severity: { label: "Severity", tone: "warn" },
    radiation: { label: "Radiation", tone: "critical" },
    trigger: { label: "Trigger", tone: "accent" },
    assoc: { label: "Associated", tone: "neutral" },
    fhx: { label: "Family hx", tone: "warn" },
    allergy: { label: "Allergies", tone: "critical" },
};

const REQUIRED: ChecklistItem[] = [
    { k: "hpi_cc", label: "Chief complaint", sec: "HPI" },
    { k: "hpi_onset", label: "Onset / duration", sec: "HPI" },
    { k: "hpi_severity", label: "Severity", sec: "HPI" },
    { k: "hpi_radiation", label: "Radiation", sec: "HPI" },
    { k: "hpi_trigger", label: "Trigger", sec: "HPI" },
    { k: "hpi_assoc", label: "Associated symptoms", sec: "HPI" },
    { k: "ros", label: "Review of systems", sec: "HPI" },
    { k: "allergy", label: "Allergies", sec: "History" },
    { k: "fhx", label: "Family history", sec: "History" },
    { k: "exam", label: "Physical exam", sec: "Exam", awaiting: true },
    { k: "assessment", label: "Assessment", sec: "Plan", awaiting: true },
    { k: "plan", label: "Plan / orders", sec: "Plan", awaiting: true },
];

// Map from parsed-field keys → required-checklist keys.
const FIELD_TO_CHECKLIST: Record<FieldKey, string> = {
    cc: "hpi_cc",
    onset: "hpi_onset",
    severity: "hpi_severity",
    radiation: "hpi_radiation",
    trigger: "hpi_trigger",
    assoc: "hpi_assoc",
    fhx: "fhx",
    allergy: "allergy",
};

// Every TimelineKey that has a corresponding REQUIRED checklist item — used
// to tick the right-rail checklist directly from `computeSignalPresence` so
// exam / assessment / plan ticks even though they aren't part of the 8-field
// summary regex extraction above.
const TIMELINE_KEY_TO_CHECKLIST: Partial<Record<TimelineKey, string>> = {
    cc: "hpi_cc",
    onset: "hpi_onset",
    severity: "hpi_severity",
    radiation: "hpi_radiation",
    trigger: "hpi_trigger",
    assoc: "hpi_assoc",
    ros: "ros",
    allergy: "allergy",
    fhx: "fhx",
    exam: "exam",
    assessment: "assessment",
    plan: "plan",
};

// Ordered list of timeline slots in the center canvas.
const TIMELINE_KEYS: TimelineKey[] = [
    "cc",
    "onset",
    "radiation",
    "trigger",
    "severity",
    "assoc",
    "ros",
    "allergy",
    "meds",
    "fhx",
    "pmh",
    "surgical",
    "social",
    "exam",
    "assessment",
    "plan",
];

function computeSignalPresence(
    note: VisitNote,
    fields: ParsedFields,
    patient: PatientSummary
): Record<TimelineKey, boolean> {
    const examFindings = note.objective?.examFindings ?? {};
    const hasExam = Object.values(examFindings).some(
        (v) => typeof v === "string" && v.trim().length > 0
    );
    const risk = note.riskFlags ?? {};
    const hasSocial =
        !!(risk as { tobaccoUse?: string }).tobaccoUse?.trim() ||
        !!(risk as { alcoholUse?: string }).alcoholUse?.trim() ||
        !!(risk as { occupation?: string }).occupation?.trim() ||
        !!(risk as { housingStatus?: string }).housingStatus?.trim();
    const assessmentText =
        note.assessmentPlan?.[0]?.assessment?.trim() || "";
    const planText = note.assessmentPlan?.[0]?.plan?.trim() || "";
    const hasOrders = (note.orders?.length ?? 0) > 0;
    const patientAllergies = Array.isArray(patient.allergies)
        ? (patient.allergies as unknown[]).length > 0
        : patient.allergies &&
          typeof patient.allergies === "object" &&
          Object.keys(patient.allergies as Record<string, unknown>).length > 0;
    return {
        cc: !!fields.cc?.trim(),
        onset: !!fields.onset?.trim(),
        radiation: !!fields.radiation?.trim(),
        trigger: !!fields.trigger?.trim(),
        severity: !!fields.severity?.trim(),
        assoc: !!fields.assoc?.trim(),
        ros: !!fields.assoc?.trim(),
        allergy: !!patientAllergies,
        meds: (note.medications?.length ?? 0) > 0,
        fhx:
            !!fields.fhx?.trim() ||
            (note.familyHistory?.length ?? 0) > 0,
        pmh: (note.pastMedicalHistory?.length ?? 0) > 0,
        surgical: (note.surgicalHistory?.length ?? 0) > 0,
        social: hasSocial,
        exam: hasExam,
        assessment: !!assessmentText,
        plan: !!planText || hasOrders,
    };
}

// Terms in a transcript that should flip a critical flag banner.
const FLAG_RULES: Array<{ match: RegExp; flag: Flag }> = [
    {
        match: /left arm|jaw|radiat(?:es|ing)/i,
        flag: { key: "cardiac_concern", tone: "critical", text: "Possible ACS pattern" },
    },
    {
        match: /short(?:ness)? of breath|sob|dyspnea/i,
        flag: { key: "respiratory_concern", tone: "warn", text: "Respiratory distress — rule out PE" },
    },
];

// ---------- Helpers ----------

function normalizeAllergies(raw: unknown): string | undefined {
    if (!raw) return undefined;
    if (Array.isArray(raw)) {
        const names = raw
            .map((a) => (typeof a === "string" ? a : (a as { name?: string })?.name))
            .filter(Boolean) as string[];
        return names.length ? names.join(", ") : undefined;
    }
    if (typeof raw === "object") {
        const values = Object.values(raw as Record<string, unknown>)
            .map((v) => (typeof v === "string" ? v : (v as { name?: string })?.name))
            .filter(Boolean) as string[];
        return values.length ? values.join(", ") : undefined;
    }
    return undefined;
}

function formatVitalTone(
    field: "bp" | "hr" | "temp" | "spo2",
    value: string | undefined
): "ok" | "warn" {
    if (!value) return "ok";
    const n = parseFloat(value);
    if (field === "bp") {
        const sys = parseFloat(value.split("/")[0]);
        return sys > 140 ? "warn" : "ok";
    }
    if (field === "hr") return n > 100 ? "warn" : "ok";
    if (field === "temp") return n >= 100.4 ? "warn" : "ok";
    if (field === "spo2") return n < 95 ? "warn" : "ok";
    return "ok";
}

// Pull the 8 summary fields out of a parsed VisitNote shape.
function extractFieldsFromNote(parsed: unknown): ParsedFields {
    if (!parsed || typeof parsed !== "object") return {};
    const p = parsed as Record<string, Record<string, unknown>>;
    const subj = (p.subjective ?? {}) as Record<string, unknown>;
    const obj = (p.objective ?? {}) as Record<string, unknown>;
    const fhx = (p.familyHistory ?? {}) as Record<string, unknown>;

    const cc = typeof subj.chiefComplaint === "string" ? (subj.chiefComplaint as string) : undefined;
    const hpi = typeof subj.hpi === "string" ? (subj.hpi as string) : "";
    const onset = matchField(hpi, /(?:for|since|started|onset)[\s:]*([^.;\n]{3,60})/i);
    const severity = matchField(hpi, /(\d{1,2}\s*\/\s*10[^.;\n]{0,40})/);
    // Catch "radiating to/into jaw", "radiating down the left arm", "radiates
    // across the chest", "radiation into the back", etc. The previous regex
    // only matched "radiat(ing|es) to|into" which missed the common natural
    // phrasing "radiating down my left arm into my jaw".
    const radiation = matchField(
        hpi,
        /radiat(?:ing|es|ion)\s+(?:to|into|down|across|through|toward|towards|up)?\s*(?:the|my|his|her)?\s*([^.;\n]{3,60})/i
    );
    const trigger = matchField(hpi, /(?:triggered|started|while|during)\s+([^.;\n]{3,40})/i);
    const assoc = matchField(hpi, /(?:associated|along with|with)\s+([^.;\n]{3,60})/i);

    const fhxVal = Array.isArray(fhx.entries)
        ? (fhx.entries as Array<Record<string, unknown>>)
              .map((e) => [e.relation, e.condition].filter(Boolean).join(" · "))
              .filter(Boolean)
              .join(", ") || undefined
        : undefined;

    const allergy = normalizeAllergies((p as unknown as { allergies?: unknown }).allergies);

    // voided but present — avoid "unused" lint flags
    void obj;

    return {
        cc: cc && cc.trim() ? cc.trim() : undefined,
        onset,
        severity,
        radiation,
        trigger,
        assoc,
        fhx: fhxVal,
        allergy,
    };
}

function matchField(text: string, re: RegExp): string | undefined {
    const match = text.match(re);
    if (!match) return undefined;
    return match[1].trim().replace(/[.,;:]+$/, "");
}

// ---------- Component ----------

type PatientSummary = {
    fullName: string;
    dob: string | null;
    avatarUrl: string | null;
    allergies: unknown;
    vitals: unknown;
};

type LiveVisitScreenProps = {
    patientId: string;
    patient: PatientSummary;
    userId: string;
    userRole: string;
};

type TranscriptEntry = {
    id: string;
    t: number; // seconds from session start
    speaker: "dr" | "pt";
    text: string;
};

export function LiveVisitScreen({
    patientId,
    patient,
    userId,
}: LiveVisitScreenProps) {
    // Recording + transcription state
    const [isRecording, setIsRecording] = React.useState(false);
    const [elapsed, setElapsed] = React.useState(0);
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);
    const [entries, setEntries] = React.useState<TranscriptEntry[]>([]);
    const [interim, setInterim] = React.useState("");

    // Derived clinical state
    const [fields, setFields] = React.useState<ParsedFields>({});
    const [filled, setFilled] = React.useState<Set<string>>(new Set());
    const [flags, setFlags] = React.useState<Flag[]>([]);
    const [flashKey, setFlashKey] = React.useState<string | null>(null);
    const [isParsing, setIsParsing] = React.useState(false);

    const transcriptRef = React.useRef<HTMLDivElement | null>(null);
    const startRef = React.useRef<number>(0);
    const liveControllerRef = React.useRef<import("@/app/_lib/ai/live-speech").LiveSpeechController | null>(null);
    const previousTranscriptsRef = React.useRef<string[]>([]);
    // Segments that have arrived since the last successful incremental parse.
    const pendingSegmentsRef = React.useRef<string[]>([]);
    const parseInFlightRef = React.useRef(false);
    const parseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestTranscriptRef = React.useRef("");
    const lastParsedLengthRef = React.useRef(0);
    // 3s baseline now that we send deltas + cache the system prompt. Doubles
    // on 429/empty, capped at 10s so a throttle never silences the UI.
    const parseBackoffRef = React.useRef(3000);
    const clockTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const runningNoteRef = React.useRef<VisitNote>(createEmptyVisitNote());
    const calibratedStreamRef = React.useRef<MediaStream | null>(null);
    const [parseThrottled, setParseThrottled] = React.useState(false);
    const [parseErrorKind, setParseErrorKind] = React.useState<
        "none" | "rate-limit" | "quota-exhausted" | "empty" | "other"
    >("none");
    const [parseStats, setParseStats] = React.useState<{
        latencyMs?: number;
        cacheHit?: boolean;
        provider?: "anthropic" | "openrouter";
    }>({});
    const [runningNote, setRunningNote] = React.useState<VisitNote>(() => createEmptyVisitNote());
    // Chronological log of data-points the AI has captured. Each entry appears
    // once, in the order it first became present on the running note. Drives
    // the vertical timeline in the center canvas.
    type LogEntry = { key: TimelineKey; t: number; ts: number };
    const [log, setLog] = React.useState<LogEntry[]>([]);
    const [lastLoggedKey, setLastLoggedKey] = React.useState<TimelineKey | null>(null);
    // One ref per scroll container so we can auto-scroll chat-style.
    const timelineScrollRef = React.useRef<HTMLDivElement | null>(null);
    const timelinePinnedToBottomRef = React.useRef(true);
    const [showCalibration, setShowCalibration] = React.useState(false);
    // Initialize to null so server and client agree on first render. Load the
    // cached calibration from localStorage in an effect after mount.
    const [calibration, setCalibration] = React.useState<CalibrationResult | null>(null);
    React.useEffect(() => {
        setCalibration(loadCalibration());
    }, []);
    const simulatorRef = React.useRef<SrtSimulator | null>(null);
    const [simulating, setSimulating] = React.useState(false);
    const [simProgress, setSimProgress] = React.useState<{ current: number; total: number } | null>(null);
    const visitDraftIdRef = React.useRef<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSigning, setIsSigning] = React.useState(false);
    const autosaveTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const consentAtRef = React.useRef<string | null>(null);
    const [consentAt, setConsentAt] = React.useState<string | null>(null);
    const [showConsentPrompt, setShowConsentPrompt] = React.useState(false);
    // persistDraft is defined below `beginRecording` but referenced via setInterval
    // inside it. Stash it on a ref so we avoid the TDZ when the deps array is
    // evaluated during render.
    const persistDraftRef = React.useRef<() => Promise<void>>(async () => undefined);

    const allergySummary = React.useMemo(() => normalizeAllergies(patient.allergies), [patient.allergies]);

    // Latest vitals (top ribbon)
    const latestVitals = React.useMemo(() => {
        if (!patient.vitals) return null;
        const list = Array.isArray(patient.vitals)
            ? patient.vitals
            : typeof patient.vitals === "object"
                ? Object.values(patient.vitals as Record<string, unknown>)
                : [];
        const recorded = list.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null);
        if (!recorded.length) return null;
        const latest = recorded[recorded.length - 1];
        return {
            bp: typeof latest.bp === "string" ? (latest.bp as string) : undefined,
            hr: typeof latest.hr === "string" ? (latest.hr as string) : undefined,
            temp: typeof latest.temp === "string" ? (latest.temp as string) : undefined,
            spo2: typeof latest.spo2 === "string" ? (latest.spo2 as string) : undefined,
        };
    }, [patient.vitals]);

    const completeCount = REQUIRED.filter((r) => filled.has(r.k)).length;

    // Auto-scroll transcript
    React.useEffect(() => {
        if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
    }, [entries.length, interim]);

    // Chat-style auto-scroll for the center timeline: pin to the bottom as
    // new items append, unless the user has scrolled up (we track that via
    // the onScroll handler on the <section>).
    React.useEffect(() => {
        const el = timelineScrollRef.current;
        if (!el) return;
        if (!timelinePinnedToBottomRef.current) return;
        // Double RAF so the new item has painted before we measure height.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollTo({
                    top: el.scrollHeight,
                    behavior: "smooth",
                });
            });
        });
    }, [log.length, lastLoggedKey]);

    // Flag detection from transcript deltas — surfaces the top-of-center banner
    // ("Possible ACS pattern"). No longer triggers order suggestions; those
    // were pulled out of the UI.
    const scanFlags = React.useCallback((newText: string) => {
        for (const rule of FLAG_RULES) {
            if (rule.match.test(newText)) {
                setFlags((prev) =>
                    prev.find((f) => f.key === rule.flag.key) ? prev : [...prev, rule.flag]
                );
            }
        }
    }, []);

    const applyParsedFields = React.useCallback((next: ParsedFields) => {
        setFields((prev) => {
            const merged: ParsedFields = { ...prev };
            let newlyFilled: FieldKey | null = null;
            (Object.keys(next) as FieldKey[]).forEach((key) => {
                const nextVal = next[key];
                if (nextVal && !prev[key]) {
                    merged[key] = nextVal;
                    newlyFilled = key;
                } else if (nextVal) {
                    merged[key] = nextVal;
                }
            });
            if (newlyFilled) {
                setFlashKey(newlyFilled);
                setTimeout(() => setFlashKey(null), 1100);
                setFilled((s) => {
                    const n = new Set(s);
                    (Object.keys(next) as FieldKey[]).forEach((k) => {
                        if (next[k]) n.add(FIELD_TO_CHECKLIST[k]);
                    });
                    // Heuristic for ROS — if we have associated symptoms, ROS is covered.
                    if (next.assoc) n.add("ros");
                    return n;
                });
            }
            return merged;
        });
    }, []);

    const applyDelta = React.useCallback(
        (delta: Partial<VisitNote>) => {
            // Merge into the running note via the shared helper so locked
            // (user-edited) paths are preserved. Today we don't have any
            // locked paths in this screen yet, but the hook is in place.
            const nextNote = mergeVisitNote(runningNoteRef.current, delta, {});
            runningNoteRef.current = nextNote;
            setRunningNote(nextNote);
            const nextFields = extractFieldsFromNote(nextNote);
            applyParsedFields(nextFields);

            // Diff the timeline-key presence against what's already in the
            // log. Anything newly-present gets appended in TIMELINE_KEYS
            // order (not merge order) so the log reads like a history.
            const elapsedSecs = Math.floor(
                (Date.now() - (startRef.current || Date.now())) / 1000
            );
            const presence = computeSignalPresence(nextNote, nextFields, patient);
            setLog((prev) => {
                const seen = new Set(prev.map((e) => e.key));
                const additions: LogEntry[] = [];
                for (const key of TIMELINE_KEYS) {
                    if (!seen.has(key) && presence[key]) {
                        additions.push({ key, t: elapsedSecs, ts: Date.now() });
                    }
                }
                if (additions.length === 0) return prev;
                setLastLoggedKey(additions[additions.length - 1].key);
                return [...prev, ...additions];
            });

            // Drive the right-rail checklist from the same presence signals.
            // The old FIELD_TO_CHECKLIST route only covered the 8 HPI summary
            // fields, so exam / assessment / plan never ticked. This route
            // mirrors the timeline's view of truth.
            setFilled((prev) => {
                let changed = false;
                const next = new Set(prev);
                for (const key of TIMELINE_KEYS) {
                    const checklistKey = TIMELINE_KEY_TO_CHECKLIST[key];
                    if (checklistKey && presence[key] && !next.has(checklistKey)) {
                        next.add(checklistKey);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        },
        [applyParsedFields, patient]
    );

    const runParse = React.useCallback(
        async (fullTranscript: string) => {
            const trimmed = fullTranscript.trim();
            if (!trimmed || parseInFlightRef.current) return;
            // Don't burn API calls when there's nothing new to say and
            // growth since the last parse is tiny.
            const growth = trimmed.length - lastParsedLengthRef.current;
            const pending = pendingSegmentsRef.current;
            if (growth < 20 && pending.length === 0) return;

            parseInFlightRef.current = true;
            setIsParsing(true);
            // Snapshot + clear the pending buffer so segments that arrive mid-parse
            // are preserved for the next cycle.
            const segmentsForThisCall = pending.slice();
            pendingSegmentsRef.current = [];
            try {
                const result = await parseTranscriptIncrementalAction({
                    newSegments: segmentsForThisCall,
                    runningNote: runningNoteRef.current,
                    fallbackFullTranscript: segmentsForThisCall.length ? undefined : trimmed,
                });
                applyDelta(result.delta);
                setParseStats({
                    latencyMs: result.latencyMs,
                    cacheHit: result.cacheHit,
                    provider: result.provider,
                });
                lastParsedLengthRef.current = trimmed.length;
                parseBackoffRef.current = 3000;
                setParseThrottled(false);
                setParseErrorKind("none");
            } catch (err) {
                // On failure put the segments back so the next poll tries again.
                pendingSegmentsRef.current = [...segmentsForThisCall, ...pendingSegmentsRef.current];
                const message = err instanceof Error ? err.message : String(err);
                const isQuotaExhausted = /free-models-per-day|daily/i.test(message);
                const isRateLimit = /429|Too Many Requests|rate.?limit/i.test(message);
                const isEmpty = /empty response/i.test(message);
                if (isQuotaExhausted) {
                    // Daily quota is gone — no amount of retry will help until
                    // the counter resets. Back off hard so we don't hammer the
                    // API, and surface a clearer banner.
                    parseBackoffRef.current = 60_000;
                    setParseThrottled(true);
                    setParseErrorKind("quota-exhausted");
                } else if (isRateLimit || isEmpty) {
                    parseBackoffRef.current = Math.min(parseBackoffRef.current * 2, 10_000);
                    setParseThrottled(true);
                    setParseErrorKind(isEmpty ? "empty" : "rate-limit");
                } else {
                    console.error("Live parse failed:", err);
                    setParseErrorKind("other");
                }
            } finally {
                parseInFlightRef.current = false;
                setIsParsing(false);
            }
        },
        [applyDelta]
    );

    const setActiveVisitDraftId = React.useCallback((nextVisitId: string | null) => {
        visitDraftIdRef.current = nextVisitId;
    }, []);

    const buildPersistedNote = React.useCallback((): VisitNote => {
        const transcript = latestTranscriptRef.current.trim();
        return {
            ...runningNoteRef.current,
            transcript: transcript || undefined,
            consents: consentAtRef.current
                ? {
                    ...runningNoteRef.current.consents,
                    aiTranscript: true,
                    aiTranscriptConfirmedAt: consentAtRef.current,
                    aiTranscriptConfirmedBy: userId,
                }
                : runningNoteRef.current.consents,
        };
    }, [userId]);

    const waitForParseIdle = React.useCallback(async () => {
        while (parseInFlightRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }, []);

    const flushLatestTranscript = React.useCallback(async () => {
        const snapshot = latestTranscriptRef.current.trim();
        if (!snapshot) return;
        await waitForParseIdle();
        lastParsedLengthRef.current = 0;
        await runParse(snapshot);
        await waitForParseIdle();
    }, [runParse, waitForParseIdle]);

    const beginRecording = React.useCallback(async () => {
        const { createLiveSpeechController, isLiveSpeechSupported } = await import(
            "@/app/_lib/ai/live-speech"
        );
        if (!isLiveSpeechSupported()) {
            toast.error(
                "This browser doesn't support live speech recognition. Try Chrome or Edge."
            );
            return;
        }

        startRef.current = Date.now();
        setIsRecording(true);
        setElapsed(0);

        clockTimerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 200);

        // Autosave draft every 15s while recording so a refresh/crash doesn't
        // lose the in-progress note.
        if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
        autosaveTimerRef.current = setInterval(() => {
            void persistDraftRef.current();
        }, 15_000);

        const controller = createLiveSpeechController({
            onStateChange: (state) => {
                if (state === "stopped") {
                    setIsRecording(false);
                }
            },
            onSnapshot: (snapshot) => {
                setInterim(snapshot.interimTranscript);
                latestTranscriptRef.current = snapshot.fullTranscript;

                if (snapshot.appendedFinalTranscript) {
                    const appended = snapshot.appendedFinalTranscript;
                    const secs = Math.floor((Date.now() - startRef.current) / 1000);
                    const entry: TranscriptEntry = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        t: secs,
                        // No diarization yet — default to clinician; user can flip.
                        speaker: "dr",
                        text: appended,
                    };
                    setEntries((prev) => [...prev, entry]);
                    previousTranscriptsRef.current = [...previousTranscriptsRef.current, appended];
                    pendingSegmentsRef.current = [...pendingSegmentsRef.current, appended];
                    scanFlags(appended);
                }
            },
            onError: (message) => {
                toast.warning(message || "Live speech interrupted.");
            },
        });
        liveControllerRef.current = controller;

        const scheduleNextParse = () => {
            parseTimerRef.current = setTimeout(async () => {
                const snapshot = latestTranscriptRef.current;
                if (snapshot) await runParse(snapshot);
                scheduleNextParse();
            }, parseBackoffRef.current);
        };
        scheduleNextParse();

        await controller.start();
    }, [runParse, scanFlags]);

    const start = React.useCallback(async () => {
        const cached = loadCalibration();
        setCalibration(cached);
        if (isCalibrationStale(cached)) {
            setShowCalibration(true);
            return;
        }
        if (!consentAtRef.current) {
            setShowConsentPrompt(true);
            return;
        }
        await beginRecording();
    }, [beginRecording]);

    const startSimulation = React.useCallback(
        async (speed = 8) => {
            try {
                // Dense synthetic transcript that exercises every section of
                // the VisitNote schema — CC/HPI, vitals, exam, meds, allergies,
                // family/surgical history, vaccines, POC labs, assessment,
                // plan, orders. Far denser than the training-video transcript.
                const cues = await fetchSrt("/demo/comprehensive-visit.srt");
                if (cues.length === 0) {
                    toast.error("Demo transcript is empty.");
                    return;
                }
                // Reset state so we can see the demo from zero.
                setFields({});
                setFilled(new Set());
                setEntries([]);
                setInterim("");
                runningNoteRef.current = createEmptyVisitNote();
                setRunningNote(createEmptyVisitNote());
                pendingSegmentsRef.current = [];
                previousTranscriptsRef.current = [];
                latestTranscriptRef.current = "";
                lastParsedLengthRef.current = 0;
                parseBackoffRef.current = 3000;

                startRef.current = Date.now();
                setIsRecording(true);
                setSimulating(true);
                setElapsed(0);
                setSimProgress({ current: 0, total: cues.length });

                if (clockTimerRef.current) clearInterval(clockTimerRef.current);
                clockTimerRef.current = setInterval(() => {
                    setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
                }, 200);

                if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
                autosaveTimerRef.current = setInterval(() => {
                    void persistDraftRef.current();
                }, 15_000);

                const sim = createSrtSimulator(cues, {
                    speed,
                    onStateChange: (state) => {
                        if (state === "stopped") {
                            setIsRecording(false);
                            setSimulating(false);
                        }
                    },
                    onSnapshot: (snapshot) => {
                        setInterim(snapshot.interimTranscript);
                        latestTranscriptRef.current = snapshot.fullTranscript;
                        if (snapshot.appendedFinalTranscript) {
                            const appended = snapshot.appendedFinalTranscript;
                            const secs = Math.floor((Date.now() - startRef.current) / 1000);
                            const entry: TranscriptEntry = {
                                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                t: secs,
                                speaker: "dr",
                                text: appended,
                            };
                            setEntries((prev) => [...prev, entry]);
                            previousTranscriptsRef.current = [
                                ...previousTranscriptsRef.current,
                                appended,
                            ];
                            pendingSegmentsRef.current = [
                                ...pendingSegmentsRef.current,
                                appended,
                            ];
                            scanFlags(appended);
                        }
                    },
                    onProgress: (current, total) =>
                        setSimProgress({ current, total }),
                });
                simulatorRef.current = sim;

                const scheduleNextParse = () => {
                    parseTimerRef.current = setTimeout(async () => {
                        const snapshot = latestTranscriptRef.current;
                        if (snapshot) await runParse(snapshot);
                        scheduleNextParse();
                    }, parseBackoffRef.current);
                };
                scheduleNextParse();

                sim.start();
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to load demo.";
                toast.error(msg);
                setSimulating(false);
            }
        },
        [runParse, scanFlags]
    );

    const handleCalibrationComplete = React.useCallback(
        async (result: CalibrationResult, stream: MediaStream, consentAtIso: string) => {
            setCalibration(result);
            setShowCalibration(false);
            consentAtRef.current = consentAtIso;
            setConsentAt(consentAtIso);
            // Release the stream — the browser SpeechRecognition engine owns
            // its own mic handle. We only needed the stream for level / noise
            // floor measurement during calibration.
            calibratedStreamRef.current?.getTracks().forEach((t) => t.stop());
            calibratedStreamRef.current = stream;
            stream.getTracks().forEach((t) => t.stop());
            calibratedStreamRef.current = null;
            await beginRecording();
        },
        [beginRecording]
    );

    const handleCalibrationCancel = React.useCallback(() => {
        setShowCalibration(false);
    }, []);

    const handleConsentConfirmed = React.useCallback(async () => {
        const confirmedAt = new Date().toISOString();
        consentAtRef.current = confirmedAt;
        setConsentAt(confirmedAt);
        setShowConsentPrompt(false);
        await beginRecording();
    }, [beginRecording]);

    const persistDraft = React.useCallback(
        async ({ propagateErrors = true }: { propagateErrors?: boolean } = {}) => {
            if (isSaving) return visitDraftIdRef.current;
            const noteToPersist = buildPersistedNote();
            const transcript = latestTranscriptRef.current.trim();
            const hasContent =
                !!noteToPersist.subjective?.chiefComplaint?.trim() ||
                !!noteToPersist.subjective?.hpi?.trim() ||
                transcript.length > 40;
            if (!hasContent) return visitDraftIdRef.current;
            setIsSaving(true);
            runningNoteRef.current = noteToPersist;
            setRunningNote(noteToPersist);
            try {
                const currentDraftId = visitDraftIdRef.current;
                if (!currentDraftId) {
                    const { visitId } = await createVisitDraftAction({
                        patientId,
                        notesJson: noteToPersist,
                        transcript,
                    });
                    setActiveVisitDraftId(visitId);
                    return visitId;
                }
                await updateVisitDraftAction(currentDraftId, {
                    notesJson: noteToPersist,
                    transcript,
                });
                return currentDraftId;
            } catch (err) {
                console.error("Draft save failed", err);
                if (propagateErrors) throw err;
                return visitDraftIdRef.current;
            } finally {
                setIsSaving(false);
            }
        },
        [buildPersistedNote, isSaving, patientId, setActiveVisitDraftId]
    );

    const stopCapture = React.useCallback(async ({ persistDraftOnStop }: { persistDraftOnStop: boolean }) => {
        setIsRecording(false);
        setSimulating(false);
        if (clockTimerRef.current) {
            clearInterval(clockTimerRef.current);
            clockTimerRef.current = null;
        }
        if (parseTimerRef.current) {
            clearTimeout(parseTimerRef.current);
            parseTimerRef.current = null;
        }
        if (autosaveTimerRef.current) {
            clearInterval(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        if (simulatorRef.current) {
            await simulatorRef.current.stop();
            simulatorRef.current = null;
        }
        if (liveControllerRef.current) {
            await liveControllerRef.current.stop();
            liveControllerRef.current = null;
        }
        await flushLatestTranscript();
        if (!persistDraftOnStop) return visitDraftIdRef.current;
        return persistDraft();
    }, [flushLatestTranscript, persistDraft]);

    const stop = React.useCallback(async () => {
        await stopCapture({ persistDraftOnStop: true });
    }, [stopCapture]);

    const stopSimulation = React.useCallback(async () => {
        await stopCapture({ persistDraftOnStop: true });
    }, [stopCapture]);

    // Keep the ref pointing at the latest persistDraft so the 15s interval uses it.
    React.useEffect(() => {
        persistDraftRef.current = async () => {
            await persistDraft({ propagateErrors: false });
        };
    }, [persistDraft]);

    const handleSignNote = React.useCallback(async () => {
        if (isSigning) return;
        setIsSigning(true);
        try {
            let draftId: string | null;
            if (isRecording || simulating) {
                draftId = await stopCapture({ persistDraftOnStop: true });
            } else {
                await flushLatestTranscript();
                draftId = await persistDraft();
            }
            if (!draftId) {
                throw new Error("A draft note is required before sign-off.");
            }
            await finalizeVisitAction(draftId, "signed");
            toast.success("Visit signed and saved.");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to sign note.";
            toast.error(msg);
        } finally {
            setIsSigning(false);
        }
    }, [flushLatestTranscript, isRecording, isSigning, persistDraft, simulating, stopCapture]);

    const reset = () => {
        setFields({});
        setFilled(new Set());
        setFlags([]);
        setEntries([]);
        setInterim("");
        runningNoteRef.current = createEmptyVisitNote();
        setRunningNote(createEmptyVisitNote());
        setLog([]);
        setLastLoggedKey(null);
        pendingSegmentsRef.current = [];
        setParseStats({});
        setElapsed(0);
        setParseThrottled(false);
        previousTranscriptsRef.current = [];
        latestTranscriptRef.current = "";
        lastParsedLengthRef.current = 0;
        parseBackoffRef.current = 3000;
    };

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            liveControllerRef.current?.destroy();
            simulatorRef.current?.destroy();
            if (clockTimerRef.current) clearInterval(clockTimerRef.current);
            if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
            if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
            calibratedStreamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    // Flip speaker on the most recent entry — nurse-friendly escape hatch for
    // the heuristic not knowing who said what.
    const toggleLastSpeaker = () => {
        setEntries((prev) => {
            if (!prev.length) return prev;
            const last = prev[prev.length - 1];
            return [
                ...prev.slice(0, -1),
                { ...last, speaker: last.speaker === "dr" ? "pt" : "dr" },
            ];
        });
    };

    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");

    return (
        <div className="flex h-full w-full flex-col" style={{ background: "var(--paper)" }}>
            <CalibrationModal
                open={showCalibration}
                onCancel={handleCalibrationCancel}
                onComplete={handleCalibrationComplete}
            />
            {/* Patient ribbon + recording controls */}
            <div
                className="flex items-center gap-4 px-4 py-3 md:px-6"
                style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
            >
                <Link
                    href={`/patients/${patientId}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                        background: "var(--card)",
                        border: "1px solid var(--line)",
                        color: "var(--ink-2)",
                    }}
                    aria-label="Back to patient"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <Avatar name={patient.fullName} src={patient.avatarUrl} size={38} />
                <div className="min-w-0 leading-tight">
                    <div className="flex items-baseline gap-2">
                        <span
                            className="serif nowrap"
                            style={{ fontSize: 20, letterSpacing: "-0.015em", color: "var(--ink)" }}
                        >
                            {patient.fullName}
                        </span>
                        {fields.cc && <Pill tone="critical" dot>{fields.cc}</Pill>}
                    </div>
                    <div className="mono text-[11px]" style={{ color: "var(--ink-3)" }}>
                        MRN {patientId.slice(0, 8).toUpperCase()}
                        {patient.dob ? ` · DOB ${patient.dob}` : null}
                        {allergySummary ? (
                            <>
                                {" · "}
                                <span style={{ color: "var(--critical)" }}>Allergies: {allergySummary}</span>
                            </>
                        ) : null}
                    </div>
                </div>
                <div className="flex-1" />
                {latestVitals && (
                    <div className="hidden items-center gap-4 md:flex">
                        {(
                            [
                                ["BP", latestVitals.bp, "bp"],
                                ["HR", latestVitals.hr, "hr"],
                                ["Temp", latestVitals.temp, "temp"],
                                ["SpO₂", latestVitals.spo2, "spo2"],
                            ] as Array<[string, string | undefined, "bp" | "hr" | "temp" | "spo2"]>
                        ).map(([label, value, key]) => {
                            const tone = formatVitalTone(key, value);
                            return (
                                <div key={label} className="text-center">
                                    <div
                                        className="text-[10px] uppercase"
                                        style={{ color: "var(--ink-3)", letterSpacing: "0.08em" }}
                                    >
                                        {label}
                                    </div>
                                    <div
                                        className="serif"
                                        style={{
                                            fontSize: 18,
                                            lineHeight: 1,
                                            letterSpacing: "-0.01em",
                                            color: tone === "warn" ? "oklch(0.5 0.12 70)" : "var(--ink)",
                                        }}
                                    >
                                        {value ?? "—"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="ml-3 flex items-center gap-2">
                    <Pill tone={isRecording ? "critical" : "neutral"} dot>
                        {isRecording ? "Recording" : "Paused"}
                    </Pill>
                    {parseStats.latencyMs != null && (
                        <span
                            className="mono text-[11px]"
                            style={{ color: parseStats.cacheHit ? "var(--ok)" : "var(--ink-3)" }}
                            title={`${parseStats.provider ?? "ai"} · ${parseStats.cacheHit ? "prompt cache hit" : "fresh parse"}`}
                        >
                            {parseStats.provider === "anthropic"
                                ? "Haiku"
                                : parseStats.provider === "openrouter"
                                ? "OR"
                                : ""}
                            {parseStats.provider ? " · " : ""}
                            {parseStats.latencyMs < 1000
                                ? `${parseStats.latencyMs}ms`
                                : `${(parseStats.latencyMs / 1000).toFixed(1)}s`}
                            {parseStats.cacheHit ? " · cached" : ""}
                        </span>
                    )}
                    <Btn kind="ghost" size="sm" onClick={() => setShowCalibration(true)}>
                        {calibration ? "Recalibrate" : "Calibrate"}
                    </Btn>
                    <Btn
                        kind="ghost"
                        size="sm"
                        onClick={() =>
                            simulating ? void stopSimulation() : void startSimulation(2)
                        }
                    >
                        {simulating
                            ? simProgress
                                ? `Stop · ${simProgress.current}/${simProgress.total}`
                                : "Stop sim"
                            : "Simulate"}
                    </Btn>
                    <Btn kind="ghost" size="sm" onClick={reset} disabled={simulating}>
                        Reset
                    </Btn>
                    <Btn
                        kind="primary"
                        size="sm"
                        icon={<FileSignature className="h-4 w-4" />}
                        disabled={
                            isSigning ||
                            isSaving ||
                            isRecording ||
                            simulating ||
                            completeCount < REQUIRED.length - 3
                        }
                        onClick={handleSignNote}
                    >
                        {isSigning ? "Signing…" : "Sign note"}
                    </Btn>
                </div>
            </div>

            <Dialog open={showConsentPrompt} onOpenChange={setShowConsentPrompt}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm AI transcript consent</DialogTitle>
                        <DialogDescription>
                            Calibration is still valid, but this visit still needs explicit patient
                            consent before live capture can begin.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm" style={{ color: "var(--ink-2)" }}>
                        Confirm that the patient has agreed to AI-assisted recording and
                        transcription for this encounter. The confirmation timestamp will be saved
                        with the visit note.
                    </div>
                    <div className="flex justify-end gap-2">
                        <Btn kind="ghost" onClick={() => setShowConsentPrompt(false)}>
                            Cancel
                        </Btn>
                        <Btn kind="primary" onClick={() => void handleConsentConfirmed()}>
                            Patient consent confirmed
                        </Btn>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Animation keyframes */}
            <style jsx>{`
                @keyframes lv-flash {
                    0% {
                        box-shadow: 0 0 0 0 var(--brand-soft);
                        background: var(--brand-soft);
                    }
                    100% {
                        box-shadow: 0 0 0 12px transparent;
                        background: var(--card);
                    }
                }
                @keyframes lv-pop {
                    0% {
                        opacity: 0;
                        transform: translateY(6px) scale(0.96);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes lv-pulse {
                    0%, 100% { opacity: 0.55; }
                    50% { opacity: 1; }
                }
                @keyframes lv-ring {
                    0% { box-shadow: 0 0 0 0 oklch(from var(--critical) l c h / 0.45); }
                    100% { box-shadow: 0 0 0 14px oklch(from var(--critical) l c h / 0); }
                }
                @keyframes lv-wave {
                    0%, 100% { transform: scaleY(0.3); }
                    50% { transform: scaleY(1); }
                }
                @keyframes lv-shimmer {
                    0% { background-position: -240px 0; }
                    100% { background-position: 240px 0; }
                }
                @keyframes lv-fade-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .lv-flash { animation: lv-flash 1100ms ease-out 1; }
                .lv-pop { animation: lv-pop 260ms ease-out 1; }
                .lv-rec-ring { animation: lv-ring 1400ms ease-out infinite; }
                .lv-wave span { transform-origin: center; animation: lv-wave 900ms ease-in-out infinite; }
                .lv-skeleton {
                    background: linear-gradient(
                        90deg,
                        var(--paper-3) 0%,
                        var(--paper-2) 50%,
                        var(--paper-3) 100%
                    );
                    background-size: 240px 100%;
                    animation: lv-shimmer 1.6s ease-in-out infinite;
                    border-radius: 4px;
                }
                .lv-skeleton-card {
                    animation: lv-fade-in 260ms ease-out 1;
                }
            `}</style>

            {/* Body: 3 columns */}
            <div
                className="grid min-h-0 flex-1"
                style={{ gridTemplateColumns: "340px 1fr 320px" }}
            >
                {/* ——— Left rail ——— */}
                <aside
                    className="flex min-h-0 flex-col"
                    style={{
                        background: "var(--paper-2)",
                        borderRight: "1px solid var(--line)",
                    }}
                >
                    {/* Mic */}
                    <div
                        className="px-4 py-4"
                        style={{ borderBottom: "1px solid var(--line)" }}
                    >
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => (isRecording ? stop() : start())}
                                className={isRecording ? "lv-rec-ring" : ""}
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 999,
                                    border: 0,
                                    cursor: "pointer",
                                    background: isRecording ? "var(--critical)" : "var(--brand-ink)",
                                    color: "white",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                                aria-label={isRecording ? "Pause recording" : "Start recording"}
                            >
                                {isRecording ? <Pause className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </button>
                            <div className="leading-tight">
                                <div
                                    className="text-[14px] font-semibold"
                                    style={{ color: isRecording ? "var(--critical)" : "var(--ink-2)" }}
                                >
                                    {isRecording ? "Listening" : "Paused"}
                                </div>
                                <div
                                    className="mono text-[12px]"
                                    style={{ color: "var(--ink-3)", marginTop: 2 }}
                                >
                                    {mm}:{ss} · auto-scribing
                                </div>
                            </div>
                        </div>

                        {/* Waveform (client-only to avoid hydration mismatch) */}
                        <div
                            className={isRecording ? "lv-wave" : ""}
                            style={{
                                display: "flex",
                                gap: 3,
                                alignItems: "center",
                                height: 28,
                                marginTop: 14,
                            }}
                            suppressHydrationWarning
                        >
                            {mounted &&
                                Array.from({ length: 54 }).map((_, i) => {
                                    const h =
                                        4 +
                                        Math.abs(
                                            Math.sin((i + 1 + elapsed) * 0.6) *
                                                Math.cos((i + 1) * 0.35)
                                        ) * 22;
                                    return (
                                        <span
                                            key={i}
                                            style={{
                                                display: "inline-block",
                                                width: 2.5,
                                                height: h,
                                                borderRadius: 2,
                                                background: isRecording
                                                    ? "var(--critical)"
                                                    : "var(--ink-4)",
                                                animationDelay: `${i * 40}ms`,
                                            }}
                                        />
                                    );
                                })}
                        </div>

                        <div
                            className="mt-3 flex items-center gap-2 text-[11px]"
                            style={{ color: "var(--ink-3)" }}
                        >
                            <button
                                type="button"
                                onClick={toggleLastSpeaker}
                                className="rounded-md px-2 py-1"
                                style={{
                                    border: "1px solid var(--line)",
                                    background: "transparent",
                                    color: "var(--ink-2)",
                                    fontSize: 11,
                                }}
                                disabled={!entries.length}
                            >
                                Toggle last speaker
                            </button>
                            {isParsing && !parseThrottled && <span>Applying…</span>}
                            {parseThrottled && parseErrorKind === "quota-exhausted" && (
                                <span style={{ color: "var(--critical)" }}>
                                    AI daily quota hit · add OpenRouter credit or wait for reset
                                </span>
                            )}
                            {parseThrottled && parseErrorKind !== "quota-exhausted" && (
                                <span style={{ color: "var(--warn)" }}>
                                    AI throttled · will retry
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Transcript header */}
                    <div
                        className="flex items-center gap-2 px-4 py-3"
                        style={{ color: "var(--ink-3)" }}
                    >
                        <span
                            aria-hidden
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                                background: isRecording ? "var(--critical)" : "var(--ink-4)",
                                animation: isRecording ? "lv-pulse 1.4s ease-in-out infinite" : "none",
                            }}
                        />
                        <div
                            className="text-[11px] font-semibold uppercase"
                            style={{ letterSpacing: "0.12em" }}
                        >
                            Live transcript
                        </div>
                    </div>

                    <div
                        ref={transcriptRef}
                        className="scroll flex-1 overflow-y-auto px-4 pb-4"
                        style={{ display: "flex", flexDirection: "column", gap: 10 }}
                    >
                        {entries.length === 0 && !interim ? (
                            <div
                                className="flex flex-1 items-center justify-center px-4 text-center text-[12.5px]"
                                style={{ color: "var(--ink-3)" }}
                            >
                                Tap the mic to begin. Each utterance will appear here as the AI scribe transcribes.
                            </div>
                        ) : (
                            entries.map((e) => <TranscriptBubble key={e.id} entry={e} />)
                        )}
                        {isRecording && interim && (
                            <div className="flex items-start gap-2 pl-9" style={{ color: "var(--ink-3)", fontStyle: "italic" }}>
                                <span className="text-[13px]">
                                    {interim}
                                    <span style={{ color: "var(--brand-ink)" }}> ●</span>
                                </span>
                            </div>
                        )}
                    </div>

                    <div
                        className="flex items-center gap-2 px-4 py-2.5 text-[11px]"
                        style={{
                            borderTop: "1px solid var(--line)",
                            color: "var(--ink-3)",
                        }}
                    >
                        <Check
                            className="h-3.5 w-3.5"
                            style={{ color: consentAt ? "var(--ok)" : "var(--warn)" }}
                        />
                        {consentAt
                            ? "Consented · encrypted · 30-day retention"
                            : "Consent required before AI capture"}
                    </div>
                </aside>

                {/* ——— Center canvas ——— */}
                <section
                    ref={timelineScrollRef}
                    onScroll={(e) => {
                        const el = e.currentTarget;
                        // Track whether the user is pinned to the bottom. If
                        // they scroll up to read something, stop auto-scrolling
                        // so we don't yank them down mid-read.
                        const nearBottom =
                            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                        timelinePinnedToBottomRef.current = nearBottom;
                    }}
                    className="scroll overflow-y-auto px-6 py-6 md:px-10"
                >
                    {flags.length > 0 && (
                        <div
                            className="lv-pop mb-5 flex items-center gap-2.5 rounded-[10px] px-3.5 py-3"
                            style={{
                                background: "var(--critical-soft)",
                                border: "1px solid transparent",
                                color: "var(--critical)",
                            }}
                        >
                            <AlertTriangle className="h-4 w-4" />
                            <div className="text-[13px] font-semibold">{flags[0].text}</div>
                            <div className="text-[12px] opacity-70">· AI caught this from the last statement. Review differential.</div>
                            <div className="flex-1" />
                            <Btn kind="plain" size="sm" onClick={() => setFlags([])}>
                                Dismiss
                            </Btn>
                        </div>
                    )}

                    {/* Header — clinical note building live */}
                    <div style={{ marginBottom: 14 }}>
                        <div
                            style={{
                                fontSize: 10.5,
                                color: "var(--ink-3)",
                                textTransform: "uppercase",
                                letterSpacing: "0.12em",
                                fontWeight: 600,
                            }}
                        >
                            Clinical note · building live
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 10,
                                marginTop: 4,
                            }}
                        >
                            <h1
                                className="serif"
                                style={{
                                    margin: 0,
                                    fontSize: 32,
                                    letterSpacing: "-0.02em",
                                    lineHeight: 1.1,
                                }}
                            >
                                {fields.cc
                                    ? `${patient.fullName} · ${fields.cc}`
                                    : "Waiting for visit to begin…"}
                            </h1>
                            <div
                                className="mono"
                                style={{
                                    fontSize: 12,
                                    color: "var(--ink-3)",
                                    marginLeft: "auto",
                                }}
                            >
                                {mm}:{ss} elapsed
                            </div>
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--ink-3)",
                                marginTop: 4,
                            }}
                        >
                            Each captured data point appears below in the order it was heard.
                        </div>
                    </div>

                    {/* Vertical timeline — populated from `log` state */}
                    <LiveTimeline
                        log={log}
                        note={runningNote}
                        fields={fields}
                        patient={patient}
                        lastLoggedKey={lastLoggedKey}
                        isRecording={isRecording}
                        planDone={filled.has("plan")}
                    />

                    {/* Legacy blocks removed — replaced by the vertical timeline above */}
                    <div style={{ display: "none" }}>
                        <div>
                            Chief complaint · captured live
                        </div>
                        <h1
                            className="serif"
                            style={{
                                margin: "6px 0 0",
                                fontSize: "clamp(34px, 4vw, 44px)",
                                letterSpacing: "-0.02em",
                                lineHeight: 1.05,
                                color: fields.cc ? "var(--ink)" : "var(--ink-4)",
                            }}
                        >
                            {fields.cc ? (
                                <>
                                    <span>{fields.cc}</span>
                                    {fields.radiation && (
                                        <>
                                            <span style={{ color: "var(--ink-3)" }}> · </span>
                                            <span>radiating {fields.radiation.toLowerCase()}</span>
                                        </>
                                    )}
                                </>
                            ) : (
                                <span style={{ fontStyle: "italic", fontWeight: 400 }}>
                                    Waiting for patient to describe…
                                </span>
                            )}
                        </h1>
                        <div
                            className="mt-3 flex flex-wrap gap-2"
                            style={{ minHeight: 26 }}
                        >
                            {fields.onset && <Pill tone="accent" dot>Onset · {fields.onset}</Pill>}
                            {fields.severity && <Pill tone="warn" dot>{fields.severity}</Pill>}
                            {fields.trigger && <Pill tone="neutral" dot>Trigger · {fields.trigger}</Pill>}
                        </div>
                    </div>

                    {/* legacy blocks hidden — replaced by LiveTimeline above */}
                    <div style={{ display: "none" }}>
                    <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
                    >
                        {FIELDS_ORDER.map((k) => {
                            const meta = FIELD_META[k];
                            const val = fields[k];
                            const fresh = flashKey === k;
                            return (
                                <div
                                    key={k}
                                    className={fresh ? "lv-flash" : ""}
                                    style={{
                                        padding: 14,
                                        borderRadius: 12,
                                        border: "1px solid var(--line)",
                                        borderStyle: val ? "solid" : "dashed",
                                        background: val ? "var(--card)" : "transparent",
                                        minHeight: 78,
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            aria-hidden
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{
                                                background: val
                                                    ? meta.tone === "accent"
                                                        ? "var(--brand-ink)"
                                                        : meta.tone === "warn"
                                                            ? "var(--warn)"
                                                            : meta.tone === "critical"
                                                                ? "var(--critical)"
                                                                : "var(--ink-3)"
                                                    : "var(--ink-4)",
                                            }}
                                        />
                                        <div
                                            className="text-[10.5px] uppercase"
                                            style={{
                                                color: "var(--ink-3)",
                                                letterSpacing: "0.1em",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {meta.label}
                                        </div>
                                        {val && (
                                            <Check
                                                className="ml-auto h-3.5 w-3.5"
                                                style={{ color: "var(--ok)" }}
                                            />
                                        )}
                                    </div>
                                    {val ? (
                                        <div
                                            className="serif mt-1.5"
                                            style={{
                                                fontSize: 18,
                                                lineHeight: 1.25,
                                                letterSpacing: "-0.01em",
                                            }}
                                        >
                                            {val}
                                        </div>
                                    ) : (
                                        <div
                                            className="mt-1.5 text-[12.5px] italic"
                                            style={{ color: "var(--ink-4)" }}
                                        >
                                            Listening for this…
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Physical exam row */}
                    <div className="mt-6">
                        <div className="mb-2.5 flex items-center gap-2">
                            <div
                                className="text-[10.5px] uppercase"
                                style={{
                                    color: "var(--ink-3)",
                                    letterSpacing: "0.12em",
                                    fontWeight: 600,
                                }}
                            >
                                Physical exam
                            </div>
                            {filled.has("exam") ? (
                                <Pill tone="ok" dot>In progress</Pill>
                            ) : (
                                <Pill tone="neutral">Not started</Pill>
                            )}
                            <div className="flex-1" />
                            <Btn
                                kind="plain"
                                size="sm"
                                icon={<Stethoscope className="h-3.5 w-3.5" />}
                            >
                                Open exam templates
                            </Btn>
                        </div>
                        <div
                            className="grid gap-2"
                            style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
                        >
                            {["General", "Cardio", "Resp", "Abd", "Extrem", "Skin"].map((sys, i) => {
                                const active = filled.has("exam");
                                return (
                                    <div
                                        key={sys}
                                        className={active ? "lv-pop" : ""}
                                        style={{
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            border: "1px solid var(--line)",
                                            borderStyle: active ? "solid" : "dashed",
                                            background: active ? "var(--card)" : "transparent",
                                            opacity: active ? 1 : 0.7,
                                            transition: "all 500ms ease",
                                            animationDelay: `${i * 80}ms`,
                                        }}
                                    >
                                        <div
                                            className="text-[11px]"
                                            style={{ color: "var(--ink-3)", fontWeight: 600 }}
                                        >
                                            {sys}
                                        </div>
                                        <div
                                            className="text-[12px]"
                                            style={{
                                                color: active ? "var(--ok)" : "var(--ink-4)",
                                            }}
                                        >
                                            {active ? "○ awaiting…" : "—"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Live-data section grid (legacy) */}
                    <LiveDataGrid note={runningNote} />
                    </div>

                </section>

                {/* ——— Right checklist ——— */}
                <aside
                    className="flex min-h-0 flex-col"
                    style={{
                        background: "var(--paper-2)",
                        borderLeft: "1px solid var(--line)",
                    }}
                >
                    <div className="px-4 pb-2 pt-4">
                        <div
                            className="text-[10.5px] uppercase"
                            style={{
                                color: "var(--ink-3)",
                                letterSpacing: "0.12em",
                                fontWeight: 600,
                            }}
                        >
                            Data checklist
                        </div>
                        <div className="mt-1.5 flex items-baseline gap-2">
                            <div
                                className="serif"
                                style={{ fontSize: 30, letterSpacing: "-0.02em" }}
                            >
                                {completeCount}
                                <span style={{ color: "var(--ink-3)" }}>
                                    /{REQUIRED.length}
                                </span>
                            </div>
                            <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                                fields captured
                            </div>
                        </div>
                        <div
                            className="mt-2.5 overflow-hidden rounded-full"
                            style={{
                                height: 4,
                                background: "var(--paper-3)",
                            }}
                        >
                            <div
                                style={{
                                    width: `${(completeCount / REQUIRED.length) * 100}%`,
                                    height: "100%",
                                    background: "var(--brand)",
                                    borderRadius: 999,
                                    transition: "width 500ms cubic-bezier(.2,.9,.3,1)",
                                }}
                            />
                        </div>
                    </div>

                    <div className="scroll flex-1 overflow-y-auto px-2 pb-4 pt-1">
                        {(["HPI", "History", "Exam", "Plan"] as const).map((sec) => {
                            const items = REQUIRED.filter((r) => r.sec === sec);
                            const nDone = items.filter((r) => filled.has(r.k)).length;
                            return (
                                <div key={sec} className="px-2.5 pb-1.5 pt-2.5">
                                    <div
                                        className="flex items-center gap-1.5 px-1.5 py-1.5 text-[10.5px] uppercase"
                                        style={{
                                            color: "var(--ink-3)",
                                            letterSpacing: "0.1em",
                                            fontWeight: 600,
                                        }}
                                    >
                                        <span>{sec}</span>
                                        <div
                                            className="h-px flex-1"
                                            style={{ background: "var(--line)" }}
                                        />
                                        <span className="mono text-[10px]">
                                            {nDone}/{items.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        {items.map((r) => {
                                            const done = filled.has(r.k);
                                            const awaiting = r.awaiting && !done;
                                            return (
                                                <div
                                                    key={r.k}
                                                    className={flashKey === r.k ? "lv-flash" : ""}
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "22px 1fr auto",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        padding: "8px 8px",
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    <span
                                                        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full"
                                                        style={{
                                                            border: `1.5px solid ${
                                                                done
                                                                    ? "transparent"
                                                                    : awaiting
                                                                        ? "var(--ink-4)"
                                                                        : "var(--line-strong)"
                                                            }`,
                                                            background: done
                                                                ? "var(--ok)"
                                                                : "transparent",
                                                            color: "white",
                                                        }}
                                                    >
                                                        {done && (
                                                            <Check
                                                                className="h-2.5 w-2.5"
                                                                strokeWidth={3}
                                                            />
                                                        )}
                                                        {awaiting && (
                                                            <span
                                                                aria-hidden
                                                                className="h-[5px] w-[5px] rounded-full"
                                                                style={{
                                                                    background: "var(--ink-4)",
                                                                    animation:
                                                                        "lv-pulse 1.4s ease-in-out infinite",
                                                                }}
                                                            />
                                                        )}
                                                    </span>
                                                    <div
                                                        className="text-[13px]"
                                                        style={{
                                                            lineHeight: 1.3,
                                                            color: done
                                                                ? "var(--ink-2)"
                                                                : awaiting
                                                                    ? "var(--ink-2)"
                                                                    : "var(--ink)",
                                                            ...(done
                                                                ? {
                                                                      textDecorationLine: "line-through",
                                                                      textDecorationThickness: "1px",
                                                                      textDecorationColor: "var(--ink-4)",
                                                                  }
                                                                : null),
                                                        }}
                                                    >
                                                        {r.label}
                                                    </div>
                                                    <span
                                                        className="text-[10px] font-semibold uppercase"
                                                        style={{
                                                            color: awaiting
                                                                ? "var(--brand-ink)"
                                                                : done
                                                                    ? "var(--ok)"
                                                                    : "var(--ink-4)",
                                                            letterSpacing: "0.08em",
                                                        }}
                                                    >
                                                        {done
                                                            ? "Got it"
                                                            : awaiting
                                                                ? "Up next"
                                                                : "Needed"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Coach */}
                    <div
                        className="p-3.5"
                        style={{
                            borderTop: "1px solid var(--line)",
                            background: "var(--card)",
                        }}
                    >
                        <div className="flex items-center gap-1.5">
                            <Sparkles
                                className="h-3.5 w-3.5"
                                style={{ color: "var(--brand-ink)" }}
                            />
                            <div
                                className="text-[10.5px] uppercase"
                                style={{
                                    color: "var(--ink-3)",
                                    letterSpacing: "0.1em",
                                    fontWeight: 600,
                                }}
                            >
                                Consider asking
                            </div>
                        </div>
                        <div
                            className="mt-1.5 text-[13px]"
                            style={{ color: "var(--ink)", lineHeight: 1.45 }}
                        >
                            {coachPrompt(completeCount, REQUIRED.length)}
                        </div>
                    </div>
                </aside>
            </div>
            <OnboardingHint
                storageKey="live-visit:v1"
                title="Tap the mic and speak naturally"
                body="Words stream in as you speak. The AI scribe parses structured notes in the background — no need to interrupt the visit. Stop the mic any time to review and edit."
                anchor="bottom-left"
            />
        </div>
    );
}

// ============================================================================
// LiveTimeline — vertical timeline matching the Clearing redesign (page 7)
// ============================================================================

type TimelineTone = "accent" | "warn" | "critical" | "neutral" | "ok";

const TONE_COLOR: Record<TimelineTone, string> = {
    accent: "var(--brand-ink)",
    warn: "var(--warn)",
    critical: "var(--critical)",
    neutral: "var(--ink-3)",
    ok: "var(--ok)",
};

interface RendererMeta {
    label: string;
    tone: TimelineTone;
    icon: React.ReactNode;
}

const RENDERER_META: Record<TimelineKey, RendererMeta> = {
    cc: { label: "Chief complaint", tone: "critical", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    onset: { label: "Onset / duration", tone: "accent", icon: <Sparkles className="h-3.5 w-3.5" /> },
    radiation: { label: "Radiation", tone: "critical", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    trigger: { label: "Trigger / context", tone: "accent", icon: <Sparkles className="h-3.5 w-3.5" /> },
    severity: { label: "Pain severity", tone: "warn", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    assoc: { label: "Associated symptoms", tone: "neutral", icon: <Stethoscope className="h-3.5 w-3.5" /> },
    ros: { label: "Review of systems", tone: "accent", icon: <Check className="h-3.5 w-3.5" /> },
    allergy: { label: "Allergies", tone: "critical", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    meds: { label: "Medications", tone: "accent", icon: <Sparkles className="h-3.5 w-3.5" /> },
    fhx: { label: "Family history", tone: "warn", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    pmh: { label: "Past medical history", tone: "warn", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    surgical: { label: "Surgical history", tone: "neutral", icon: <Stethoscope className="h-3.5 w-3.5" /> },
    social: { label: "Social history", tone: "neutral", icon: <Stethoscope className="h-3.5 w-3.5" /> },
    exam: { label: "Physical exam", tone: "ok", icon: <Stethoscope className="h-3.5 w-3.5" /> },
    assessment: { label: "Assessment", tone: "neutral", icon: <FileSignature className="h-3.5 w-3.5" /> },
    plan: { label: "Plan / orders", tone: "accent", icon: <Sparkles className="h-3.5 w-3.5" /> },
};

interface RendererContext {
    note: VisitNote;
    fields: ParsedFields;
    patient: PatientSummary;
}

function renderField(key: TimelineKey, ctx: RendererContext): React.ReactNode {
    const { note, fields, patient } = ctx;
    switch (key) {
        case "cc":
            return (
                <>
                    <div
                        className="serif"
                        style={{ fontSize: 26, letterSpacing: "-0.02em", lineHeight: 1.1 }}
                    >
                        {fields.cc}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>
                        Patient-reported · verbatim
                    </div>
                </>
            );
        case "onset":
            return (
                <div>
                    <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.015em" }}>
                        {fields.onset}
                    </div>
                    <div
                        style={{
                            position: "relative",
                            height: 6,
                            marginTop: 10,
                            background: "var(--paper-3)",
                            borderRadius: 999,
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                left: "8%",
                                right: "4%",
                                top: 0,
                                bottom: 0,
                                background: "var(--brand-soft)",
                                borderRadius: 999,
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                left: "8%",
                                top: -2,
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: "var(--brand-ink)",
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                right: "4%",
                                top: -2,
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: "var(--critical)",
                                boxShadow: "0 0 0 3px var(--critical-soft)",
                            }}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 4,
                            fontSize: 10,
                            color: "var(--ink-3)",
                        }}
                    >
                        <span>Onset</span>
                        <span>Now</span>
                    </div>
                </div>
            );
        case "radiation":
            return (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                        className="serif"
                        style={{ fontSize: 18, letterSpacing: "-0.01em" }}
                    >
                        {fields.radiation}
                    </div>
                    <div
                        style={{
                            marginLeft: "auto",
                            fontSize: 11,
                            color: "var(--critical)",
                            fontWeight: 600,
                        }}
                    >
                        ⚠ Classic ACS pattern
                    </div>
                </div>
            );
        case "trigger":
            return (
                <div>
                    <div className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em" }}>
                        {fields.trigger}
                    </div>
                </div>
            );
        case "severity": {
            const nMatch = fields.severity?.match(/(\d{1,2})\s*\/\s*10/);
            const n = nMatch ? Math.min(10, Math.max(0, parseInt(nMatch[1], 10))) : 0;
            return (
                <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <div
                            className="serif"
                            style={{ fontSize: 30, letterSpacing: "-0.02em", color: "var(--warn)" }}
                        >
                            {n || "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>now</div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: "auto" }}>
                            {fields.severity}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
                        {Array.from({ length: 10 }).map((_, i) => {
                            const on = i < n;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        flex: 1,
                                        height: 16,
                                        borderRadius: 3,
                                        background: on
                                            ? i < 3
                                                ? "var(--ok)"
                                                : i < 6
                                                ? "var(--warn)"
                                                : "var(--critical)"
                                            : "var(--paper-3)",
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }
        case "assoc": {
            const text = fields.assoc ?? "";
            return (
                <div
                    style={{
                        fontSize: 13,
                        color: "var(--ink-2)",
                        lineHeight: 1.45,
                    }}
                >
                    {text}
                </div>
            );
        }
        case "ros":
            return (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: 4,
                    }}
                >
                    {["Const", "CV", "Resp", "GI", "GU", "Neuro", "MSK"].map((s, i) => {
                        const done = i < 4;
                        return (
                            <div key={s} style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        height: 24,
                                        borderRadius: 6,
                                        background: done ? "var(--ok-soft, var(--paper-3))" : "var(--paper-3)",
                                        border: done ? "1px solid transparent" : "1px solid var(--line)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: done ? "var(--ok)" : "var(--ink-4)",
                                    }}
                                >
                                    {done ? (
                                        <Check className="h-3 w-3" />
                                    ) : (
                                        <span style={{ fontSize: 10 }}>—</span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        fontSize: 9.5,
                                        color: "var(--ink-3)",
                                        marginTop: 3,
                                    }}
                                >
                                    {s}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        case "allergy": {
            const all = patient.allergies;
            const names: string[] = Array.isArray(all)
                ? (all as unknown[])
                      .map((a) => (typeof a === "string" ? a : (a as { name?: string })?.name))
                      .filter((s): s is string => !!s)
                : typeof all === "object" && all
                ? (Object.values(all as Record<string, unknown>)
                      .map((v) => (typeof v === "string" ? v : (v as { name?: string })?.name))
                      .filter((s): s is string => !!s))
                : [];
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {names.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>None on file</div>
                    ) : (
                        names.map((drug) => (
                            <div
                                key={drug}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    background: "var(--critical-soft)",
                                    border: "1px solid var(--critical)",
                                }}
                            >
                                <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--critical)" }} />
                                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--critical)" }}>
                                    {drug}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            );
        }
        case "meds": {
            const meds = (note.medications ?? []).filter(
                (m) => m && (m.brandName || m.dosage || m.strength)
            );
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {meds.map((m, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 6,
                                fontSize: 12.5,
                            }}
                        >
                            <span
                                style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 999,
                                    background: "var(--brand-ink)",
                                    alignSelf: "center",
                                }}
                            />
                            <span style={{ fontWeight: 600 }}>{m.brandName || "Medication"}</span>
                            {m.strength && (
                                <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                                    {m.strength}
                                </span>
                            )}
                            {m.frequency && (
                                <span
                                    style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}
                                >
                                    {m.frequency}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            );
        }
        case "fhx":
            return (
                <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                    {fields.fhx ||
                        (note.familyHistory || [])
                            .map(
                                (f) =>
                                    `${f.relationship || ""}${
                                        f.conditions ? ` · ${f.conditions}` : ""
                                    }`
                            )
                            .filter(Boolean)
                            .join(" / ")}
                </div>
            );
        case "pmh": {
            const pmh = (note.pastMedicalHistory ?? []).filter((p) => p?.condition?.trim());
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {pmh.map((p, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: "var(--paper-3)",
                                fontSize: 11.5,
                            }}
                        >
                            <span style={{ fontWeight: 600 }}>{p.condition}</span>
                            {p.diagnosedDate && (
                                <span
                                    style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}
                                >
                                    {p.diagnosedDate}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            );
        }
        case "surgical": {
            const sx = (note.surgicalHistory ?? []).filter((s) => s?.procedure?.trim());
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {sx.map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 8,
                                    background: "var(--paper-3)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--ink-2)",
                                }}
                            >
                                <Stethoscope className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.procedure}</div>
                                {s.date && (
                                    <div
                                        className="mono"
                                        style={{ fontSize: 10.5, color: "var(--ink-3)" }}
                                    >
                                        {s.date}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        case "social": {
            const rf = (note.riskFlags ?? {}) as Record<string, string | undefined>;
            const cells = [
                { l: "Tobacco", v: rf.tobaccoUse || "—" },
                { l: "Alcohol", v: rf.alcoholUse || "—" },
                { l: "Work", v: rf.occupation || "—" },
            ];
            return (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 6,
                    }}
                >
                    {cells.map((c) => (
                        <div
                            key={c.l}
                            style={{
                                padding: "6px 4px",
                                borderRadius: 6,
                                textAlign: "center",
                                background: "var(--paper-3)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 9.5,
                                    color: "var(--ink-3)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    fontWeight: 600,
                                }}
                            >
                                {c.l}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    marginTop: 2,
                                    color: "var(--ink)",
                                }}
                            >
                                {c.v}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        case "exam": {
            const findings = (note.objective?.examFindings ?? {}) as Record<string, string>;
            const rows = Object.entries(findings)
                .filter(([, v]) => typeof v === "string" && v.trim())
                .slice(0, 6);
            return (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 8,
                    }}
                >
                    {rows.map(([sys, finding]) => (
                        <div
                            key={sys}
                            style={{
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: "var(--paper-3)",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 999,
                                    marginTop: 6,
                                    background: "var(--ok)",
                                }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: "var(--ink-3)",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                    }}
                                >
                                    {sys}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--ink)",
                                        marginTop: 1,
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {finding}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        case "assessment":
            return (
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                    {(note.assessmentPlan ?? [])
                        .filter((a) => a?.assessment?.trim())
                        .map((a, i) => (
                            <div
                                key={i}
                                className="serif"
                                style={{
                                    fontSize: 14,
                                    lineHeight: 1.4,
                                    letterSpacing: "-0.005em",
                                }}
                            >
                                {a.assessment}
                            </div>
                        ))}
                </div>
            );
        case "plan": {
            const plans = (note.assessmentPlan ?? []).filter((a) => a?.plan?.trim());
            const orders = (note.orders ?? []).filter((o) => o?.type || o?.details);
            return (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: orders.length ? "1fr 1fr" : "1fr",
                        gap: 12,
                    }}
                >
                    {plans.length > 0 && (
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: "var(--ink-3)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    fontWeight: 600,
                                    marginBottom: 6,
                                }}
                            >
                                Disposition
                            </div>
                            <ul
                                style={{
                                    margin: 0,
                                    padding: "0 0 0 18px",
                                    fontSize: 12.5,
                                    lineHeight: 1.55,
                                }}
                            >
                                {plans.map((a, i) => (
                                    <li key={i}>{a.plan}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {orders.length > 0 && (
                        <div>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: "var(--brand-ink)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    fontWeight: 600,
                                    marginBottom: 6,
                                }}
                            >
                                Orders queued
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                {orders.map((o, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            padding: "4px 8px",
                                            background: "var(--brand-soft)",
                                            borderRadius: 6,
                                            fontSize: 11.5,
                                        }}
                                    >
                                        <Check
                                            className="h-3.5 w-3.5"
                                            style={{ color: "var(--brand-ink)" }}
                                        />
                                        <span style={{ fontWeight: 600 }}>{o.type || o.details}</span>
                                        {o.priority && (
                                            <span
                                                style={{
                                                    marginLeft: "auto",
                                                    fontSize: 10,
                                                    color: "var(--brand-ink)",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {o.priority}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    }
}

function TimelineItem({
    entry,
    ctx,
    isNew,
    isLast,
}: {
    entry: { key: TimelineKey; t: number };
    ctx: RendererContext;
    isNew: boolean;
    isLast: boolean;
}) {
    const meta = RENDERER_META[entry.key];
    const toneColor = TONE_COLOR[meta.tone];
    const mm = String(Math.floor(entry.t / 60)).padStart(2, "0");
    const ss = String(Math.floor(entry.t % 60)).padStart(2, "0");

    return (
        <div
            className={isNew ? "lv-pop" : ""}
            style={{
                display: "grid",
                gridTemplateColumns: "64px 36px 1fr",
                gap: 0,
                position: "relative",
            }}
        >
            {/* Timestamp */}
            <div style={{ textAlign: "right", paddingRight: 12, paddingTop: 16 }}>
                <div
                    className="mono"
                    style={{
                        fontSize: 11.5,
                        color: "var(--ink-2)",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                    }}
                >
                    {mm}:{ss}
                </div>
                <div
                    style={{
                        fontSize: 9.5,
                        color: "var(--ink-4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginTop: 2,
                    }}
                >
                    captured
                </div>
            </div>

            {/* Spine + dot */}
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        bottom: isLast ? "50%" : 0,
                        width: 2,
                        background: "var(--line)",
                        left: "50%",
                        transform: "translateX(-50%)",
                    }}
                />
                <div
                    style={{
                        marginTop: 18,
                        position: "relative",
                        zIndex: 1,
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: "var(--paper)",
                        border: `2px solid ${toneColor}`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: toneColor,
                    }}
                >
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: toneColor,
                        }}
                    />
                    {isNew && (
                        <span
                            className="lv-rec-ring"
                            style={{
                                position: "absolute",
                                inset: -4,
                                borderRadius: 999,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Card */}
            <div
                style={{
                    padding: 12,
                    marginBottom: 10,
                    marginTop: 8,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "var(--card)",
                    minWidth: 0,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 8,
                    }}
                >
                    <span style={{ color: toneColor, display: "inline-flex" }}>{meta.icon}</span>
                    <div
                        style={{
                            fontSize: 10.5,
                            color: "var(--ink-3)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontWeight: 600,
                        }}
                    >
                        {meta.label}
                    </div>
                    {isNew && (
                        <Pill tone="accent" dot>
                            Just captured
                        </Pill>
                    )}
                    <Check
                        className="h-3.5 w-3.5"
                        style={{ marginLeft: "auto", color: "var(--ok)" }}
                    />
                </div>
                <div>{renderField(entry.key, ctx)}</div>
            </div>
        </div>
    );
}

function LiveTimeline({
    log,
    note,
    fields,
    patient,
    lastLoggedKey,
    isRecording,
    planDone,
}: {
    log: { key: TimelineKey; t: number; ts: number }[];
    note: VisitNote;
    fields: ParsedFields;
    patient: PatientSummary;
    lastLoggedKey: TimelineKey | null;
    isRecording: boolean;
    planDone: boolean;
}) {
    const ctx: RendererContext = { note, fields, patient };
    if (log.length === 0) {
        return (
            <div
                style={{
                    padding: 32,
                    border: "1px dashed var(--line)",
                    borderRadius: 12,
                    textAlign: "center",
                    color: "var(--ink-4)",
                    fontSize: 13,
                    fontStyle: "italic",
                }}
            >
                The note will build itself as the patient speaks — each data point appears here in real time.
            </div>
        );
    }
    // Next 2 unseen keys — rendered as skeleton cards so the doctor can see
    // what the system is still listening for. Each skeleton morphs into a
    // real TimelineItem the moment its key is captured.
    const seen = new Set(log.map((e) => e.key));
    const upcoming = TIMELINE_KEYS.filter((k) => !seen.has(k)).slice(0, 2);

    return (
        <div>
            {log.map((entry, i) => {
                const isNew = entry.key === lastLoggedKey;
                // `isLast` only controls spine-trimming on the final card.
                // With skeletons below, only trim when there are no more
                // upcoming keys either.
                const isLast =
                    i === log.length - 1 && upcoming.length === 0 && !planDone;
                return (
                    <TimelineItem
                        key={entry.key}
                        entry={entry}
                        ctx={ctx}
                        isNew={isNew}
                        isLast={isLast}
                    />
                );
            })}
            {isRecording &&
                upcoming.map((key, i) => (
                    <SkeletonTimelineItem
                        key={`skeleton-${key}`}
                        fieldKey={key}
                        isLast={i === upcoming.length - 1}
                    />
                ))}
        </div>
    );
}

function SkeletonTimelineItem({
    fieldKey,
    isLast,
}: {
    fieldKey: TimelineKey;
    isLast: boolean;
}) {
    const meta = RENDERER_META[fieldKey];
    return (
        <div
            className="lv-skeleton-card"
            style={{
                display: "grid",
                gridTemplateColumns: "64px 36px 1fr",
                gap: 0,
                position: "relative",
                opacity: 0.6,
            }}
        >
            {/* Timestamp — dashed placeholder */}
            <div style={{ textAlign: "right", paddingRight: 12, paddingTop: 16 }}>
                <div
                    className="lv-skeleton"
                    style={{ height: 10, width: 32, marginLeft: "auto" }}
                />
                <div
                    style={{
                        fontSize: 9.5,
                        color: "var(--ink-4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginTop: 4,
                    }}
                >
                    awaiting
                </div>
            </div>
            {/* Spine + hollow dot */}
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        bottom: isLast ? "50%" : 0,
                        width: 2,
                        background: "var(--line)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        borderLeft: "2px dashed var(--line)",
                        backgroundColor: "transparent",
                    }}
                />
                <div
                    style={{
                        marginTop: 18,
                        position: "relative",
                        zIndex: 1,
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        background: "var(--paper)",
                        border: "1.5px dashed var(--ink-4)",
                    }}
                />
            </div>
            {/* Card — dashed border, label visible, body shimmer */}
            <div
                style={{
                    padding: 12,
                    marginBottom: 10,
                    marginTop: 8,
                    borderRadius: 10,
                    border: "1px dashed var(--line-strong)",
                    background: "transparent",
                    minWidth: 0,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 10,
                    }}
                >
                    <span
                        style={{
                            color: "var(--ink-4)",
                            display: "inline-flex",
                            opacity: 0.7,
                        }}
                    >
                        {meta.icon}
                    </span>
                    <div
                        style={{
                            fontSize: 10.5,
                            color: "var(--ink-4)",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontWeight: 600,
                        }}
                    >
                        {meta.label}
                    </div>
                    <span
                        className="text-[10px] font-semibold uppercase"
                        style={{
                            marginLeft: "auto",
                            color: "var(--ink-4)",
                            letterSpacing: "0.08em",
                            display: "inline-flex",
                            gap: 3,
                            alignItems: "center",
                        }}
                    >
                        <span
                            style={{
                                display: "inline-flex",
                                gap: 2,
                            }}
                        >
                            {[0, 1, 2].map((i) => (
                                <span
                                    key={i}
                                    style={{
                                        width: 3,
                                        height: 3,
                                        borderRadius: 999,
                                        background: "var(--ink-4)",
                                        animation: `lv-pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                                    }}
                                />
                            ))}
                        </span>
                        Listening
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="lv-skeleton" style={{ height: 12, width: "70%" }} />
                    <div className="lv-skeleton" style={{ height: 10, width: "45%" }} />
                </div>
            </div>
        </div>
    );
}

function LiveDataGrid({ note }: { note: VisitNote }) {
    const vitals = [
        { label: "BP", value: note.objective?.bp },
        { label: "HR", value: note.objective?.hr },
        { label: "Temp", value: note.objective?.temp },
        { label: "SpO₂", value: note.objective?.spo2 },
        { label: "Weight", value: note.objective?.weight ? `${note.objective.weight} lb` : undefined },
        { label: "Height", value: note.objective?.height ? `${note.objective.height} cm` : undefined },
        { label: "BMI", value: note.objective?.bmi },
    ];
    const hasVitals = vitals.some((v) => v.value);
    const examEntries = note.objective?.examFindings
        ? Object.entries(note.objective.examFindings).filter(
              ([, v]) => typeof v === "string" && v.trim()
          )
        : [];
    const meds = Array.isArray(note.medications) ? note.medications.filter((m) => m && (m.brandName || m.dosage)) : [];
    const allergies = Array.isArray((note as unknown as { allergies?: unknown[] }).allergies)
        ? ((note as unknown as { allergies?: Array<{ name?: string }> }).allergies || []).filter((a) => a?.name)
        : [];
    const assessments = Array.isArray(note.assessmentPlan) ? note.assessmentPlan.filter((a) => a && (a.assessment || a.plan)) : [];
    const orders = Array.isArray(note.orders) ? note.orders.filter((o) => o && (o.type || o.details)) : [];
    const fhx = Array.isArray(note.familyHistory)
        ? note.familyHistory.filter((f) => f && (f.relationship || (Array.isArray(f.conditions) && f.conditions.length)))
        : [];
    const hpi = note.subjective?.hpi;

    return (
        <div className="mt-6">
            <div className="mb-2.5 flex items-center gap-2">
                <div
                    className="text-[10.5px] uppercase"
                    style={{
                        color: "var(--ink-3)",
                        letterSpacing: "0.12em",
                        fontWeight: 600,
                    }}
                >
                    Live data · filling in real time
                </div>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                <SectionCard title="Vitals" empty={!hasVitals} emptyLabel="Listening for vitals…">
                    <div className="grid grid-cols-3 gap-2">
                        {vitals
                            .filter((v) => v.value)
                            .map((v) => (
                                <div key={v.label}>
                                    <div
                                        className="text-[10px] uppercase"
                                        style={{ color: "var(--ink-3)", letterSpacing: "0.08em" }}
                                    >
                                        {v.label}
                                    </div>
                                    <div className="serif" style={{ fontSize: 18, letterSpacing: "-0.01em" }}>
                                        {v.value}
                                    </div>
                                </div>
                            ))}
                    </div>
                </SectionCard>

                <SectionCard title="HPI" empty={!hpi?.trim()} emptyLabel="Waiting for a narrative…">
                    <div className="text-[13px]" style={{ color: "var(--ink-2)", lineHeight: 1.45 }}>
                        {hpi}
                    </div>
                </SectionCard>

                <SectionCard title="Medications" empty={meds.length === 0} emptyLabel="No meds mentioned yet">
                    <ul className="space-y-1">
                        {meds.map((m, i) => (
                            <li key={i} className="text-[13px]" style={{ color: "var(--ink)" }}>
                                <span style={{ fontWeight: 600 }}>{m.brandName || "Medication"}</span>
                                {m.strength ? <span style={{ color: "var(--ink-2)" }}> · {m.strength}</span> : null}
                                {m.dosage ? <span style={{ color: "var(--ink-2)" }}> · {m.dosage}</span> : null}
                                {m.frequency ? <span style={{ color: "var(--ink-2)" }}> · {m.frequency}</span> : null}
                            </li>
                        ))}
                    </ul>
                </SectionCard>

                <SectionCard title="Allergies" empty={allergies.length === 0} emptyLabel="None noted yet">
                    <div className="text-[13px]" style={{ color: "var(--ink)" }}>
                        {allergies.map((a) => a.name).join(", ")}
                    </div>
                </SectionCard>

                <SectionCard title="Family history" empty={fhx.length === 0} emptyLabel="No family history yet">
                    <ul className="space-y-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
                        {fhx.map((f, i) => (
                            <li key={i}>
                                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{f.relationship}</span>
                                {Array.isArray(f.conditions) && f.conditions.length
                                    ? ` · ${f.conditions.join(", ")}`
                                    : null}
                            </li>
                        ))}
                    </ul>
                </SectionCard>

                <SectionCard
                    title="Exam findings"
                    empty={examEntries.length === 0}
                    emptyLabel="Not yet documented"
                >
                    <dl className="grid grid-cols-1 gap-1">
                        {examEntries.map(([sys, finding]) => (
                            <div key={sys} className="text-[12.5px]">
                                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{sys}:</span>{" "}
                                <span style={{ color: "var(--ink-2)" }}>{String(finding)}</span>
                            </div>
                        ))}
                    </dl>
                </SectionCard>

                <SectionCard
                    title="Assessment & plan"
                    empty={assessments.length === 0}
                    emptyLabel="No assessment yet"
                    span={2}
                >
                    <ul className="space-y-2">
                        {assessments.map((a, i) => (
                            <li key={i} className="rounded-md" style={{ background: "var(--paper-3)", padding: 8 }}>
                                <div className="text-[13px]" style={{ fontWeight: 600, color: "var(--ink)" }}>
                                    {a.assessment}
                                </div>
                                {a.plan ? (
                                    <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                                        Plan: {a.plan}
                                    </div>
                                ) : null}
                                {a.followUp ? (
                                    <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                                        Follow-up: {a.followUp}
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </SectionCard>

                <SectionCard title="Orders" empty={orders.length === 0} emptyLabel="No orders yet" span={2}>
                    <ul className="space-y-1 text-[13px]">
                        {orders.map((o, i) => (
                            <li key={i} style={{ color: "var(--ink)" }}>
                                <span style={{ fontWeight: 600 }}>{o.type}</span>
                                {o.details ? <span style={{ color: "var(--ink-2)" }}> · {o.details}</span> : null}
                                {o.priority ? <span style={{ color: "var(--ink-3)" }}> · {o.priority}</span> : null}
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            </div>
        </div>
    );
}

function SectionCard({
    title,
    children,
    empty,
    emptyLabel,
    span = 1,
}: {
    title: string;
    children: React.ReactNode;
    empty: boolean;
    emptyLabel: string;
    span?: 1 | 2;
}) {
    return (
        <div
            style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid var(--line)",
                borderStyle: empty ? "dashed" : "solid",
                background: empty ? "transparent" : "var(--card)",
                gridColumn: span === 2 ? "1 / -1" : undefined,
                minHeight: 78,
            }}
        >
            <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em", fontWeight: 600 }}
            >
                {title}
            </div>
            <div className="mt-2">
                {empty ? (
                    <div className="text-[12.5px] italic" style={{ color: "var(--ink-4)" }}>
                        {emptyLabel}
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>
    );
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
    const isDoctor = entry.speaker === "dr";
    const mm = String(Math.floor(entry.t / 60)).padStart(2, "0");
    const ss = String(Math.floor(entry.t % 60)).padStart(2, "0");
    return (
        <div className="lv-pop flex items-start gap-2">
            <span
                className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                    background: isDoctor ? "var(--brand-soft)" : "var(--paper-3)",
                    color: isDoctor ? "var(--brand-ink)" : "var(--ink-2)",
                }}
            >
                {isDoctor ? "DR" : "PT"}
            </span>
            <div className="min-w-0 flex-1 leading-[1.5]">
                <div
                    className="mono text-[10px]"
                    style={{ color: "var(--ink-3)" }}
                >
                    {mm}:{ss}
                </div>
                <div
                    className="text-[13.2px]"
                    style={{
                        color: isDoctor ? "var(--ink-2)" : "var(--ink)",
                        fontWeight: isDoctor ? 400 : 500,
                    }}
                >
                    {entry.text}
                </div>
            </div>
        </div>
    );
}

function coachPrompt(done: number, total: number): React.ReactNode {
    if (done < 3) return 'Try: "Can you describe the pain — sharp, dull, pressure?"';
    if (done < 6) return 'Try: "Have you had anything like this before?"';
    if (done < total - 3) return 'Try: "Any medications you take regularly?"';
    return (
        <>
            You&rsquo;ve covered the essentials. Ready for exam + sign.
            <ChevronRight className="ml-1 inline h-3.5 w-3.5" />
        </>
    );
}
