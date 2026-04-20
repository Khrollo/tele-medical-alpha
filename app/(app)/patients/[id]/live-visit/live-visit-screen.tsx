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

import { Avatar, Btn, Pill, type PillTone } from "@/components/ui/clearing";
import { parseTranscriptDraftAction } from "@/app/_actions/visits";

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

const SUGGESTED_ORDERS: Record<string, { t: string; n: string; d: string }> = {
    order_ekg: { t: "Imaging", n: "12-lead EKG", d: "STAT · bedside" },
    order_trop: { t: "Lab", n: "Troponin I × 2", d: "STAT, repeat 3h" },
    order_asa: { t: "Med", n: "Aspirin 325 mg", d: "Chew × 1 now" },
};

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
    const radiation = matchField(hpi, /radiat(?:ing|es)\s+(?:to|into)\s+([^.;\n]{3,40})/i);
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
    const [suggestedOrders, setSuggestedOrders] = React.useState<Set<string>>(new Set());
    const [flashKey, setFlashKey] = React.useState<string | null>(null);
    const [isParsing, setIsParsing] = React.useState(false);

    const transcriptRef = React.useRef<HTMLDivElement | null>(null);
    const startRef = React.useRef<number>(0);
    const liveControllerRef = React.useRef<import("@/app/_lib/ai/live-speech").LiveSpeechController | null>(null);
    const previousTranscriptsRef = React.useRef<string[]>([]);
    const parseInFlightRef = React.useRef(false);
    const parseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestTranscriptRef = React.useRef("");
    const lastParsedLengthRef = React.useRef(0);
    const parseBackoffRef = React.useRef(8000); // ms — doubles on 429, floors at 8s
    const clockTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const [parseThrottled, setParseThrottled] = React.useState(false);

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

    // Flag detection from transcript deltas
    const scanFlags = React.useCallback((newText: string) => {
        for (const rule of FLAG_RULES) {
            if (rule.match.test(newText)) {
                setFlags((prev) =>
                    prev.find((f) => f.key === rule.flag.key) ? prev : [...prev, rule.flag]
                );
                if (rule.flag.key === "cardiac_concern") {
                    setSuggestedOrders((prev) => new Set([...prev, "order_ekg", "order_trop", "order_asa"]));
                }
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

    const runParse = React.useCallback(
        async (fullTranscript: string) => {
            const trimmed = fullTranscript.trim();
            if (!trimmed || parseInFlightRef.current) return;
            // Don't burn API calls when the transcript hasn't grown by a
            // meaningful amount since the last successful parse.
            if (trimmed.length - lastParsedLengthRef.current < 40) return;

            parseInFlightRef.current = true;
            setIsParsing(true);
            try {
                const result = await parseTranscriptDraftAction({
                    transcript: trimmed,
                    previousTranscripts: previousTranscriptsRef.current,
                });
                applyParsedFields(extractFieldsFromNote(result.parsed));
                lastParsedLengthRef.current = trimmed.length;
                // Success — relax the backoff back to the baseline.
                parseBackoffRef.current = 8000;
                setParseThrottled(false);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                const isRateLimit = /429|Too Many Requests|rate.?limit/i.test(message);
                const isEmpty = /empty response/i.test(message);
                if (isRateLimit || isEmpty) {
                    // Exponential backoff, capped at 60s, to let the free tier
                    // cool down without spamming the console.
                    parseBackoffRef.current = Math.min(parseBackoffRef.current * 2, 60_000);
                    setParseThrottled(true);
                } else {
                    console.error("Live parse failed:", err);
                }
            } finally {
                parseInFlightRef.current = false;
                setIsParsing(false);
            }
        },
        [applyParsedFields]
    );

    // Start / stop controls
    const start = React.useCallback(async () => {
        const { createLiveSpeechController, isLiveSpeechSupported } = await import(
            "@/app/_lib/ai/live-speech"
        );
        if (!isLiveSpeechSupported()) {
            toast.error(
                "This browser doesn't support live speech recognition. Try Chrome or Safari."
            );
            return;
        }

        startRef.current = Date.now();
        setIsRecording(true);
        setElapsed(0);

        clockTimerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        }, 200);

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
                        // Dumb heuristic: odd final index = patient, even = clinician. We don't
                        // have diarization. Default everything to clinician; flip via button
                        // later if needed.
                        speaker: "dr",
                        text: appended,
                    };
                    setEntries((prev) => [...prev, entry]);
                    previousTranscriptsRef.current = [...previousTranscriptsRef.current, appended];
                    scanFlags(appended);
                }
            },
            onError: (message) => {
                toast.warning(message || "Live speech interrupted.");
            },
        });
        liveControllerRef.current = controller;

        // Adaptive polling — self-reschedules with the current backoff so a
        // 429 from OpenRouter doubles the delay instead of compounding.
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

    const stop = React.useCallback(async () => {
        setIsRecording(false);
        if (clockTimerRef.current) {
            clearInterval(clockTimerRef.current);
            clockTimerRef.current = null;
        }
        if (parseTimerRef.current) {
            clearTimeout(parseTimerRef.current);
            parseTimerRef.current = null;
        }
        const snapshot = latestTranscriptRef.current;
        await liveControllerRef.current?.stop();
        // Final parse after a beat so the last utterance is captured.
        if (snapshot) {
            // Force a final parse even if under the growth threshold.
            lastParsedLengthRef.current = 0;
            void runParse(snapshot);
        }
    }, [runParse]);

    const reset = () => {
        setFields({});
        setFilled(new Set());
        setFlags([]);
        setSuggestedOrders(new Set());
        setEntries([]);
        setInterim("");
        setElapsed(0);
        setParseThrottled(false);
        previousTranscriptsRef.current = [];
        latestTranscriptRef.current = "";
        lastParsedLengthRef.current = 0;
        parseBackoffRef.current = 8000;
    };

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            liveControllerRef.current?.destroy();
            if (clockTimerRef.current) clearInterval(clockTimerRef.current);
            if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
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
                <Avatar name={patient.fullName} size={38} />
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
                    <Btn kind="ghost" size="sm" onClick={reset}>
                        Reset
                    </Btn>
                    <Btn
                        kind="primary"
                        size="sm"
                        icon={<FileSignature className="h-4 w-4" />}
                        disabled={completeCount < REQUIRED.length - 3}
                    >
                        Sign note
                    </Btn>
                </div>
            </div>

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
                .lv-flash { animation: lv-flash 1100ms ease-out 1; }
                .lv-pop { animation: lv-pop 260ms ease-out 1; }
                .lv-rec-ring { animation: lv-ring 1400ms ease-out infinite; }
                .lv-wave span { transform-origin: center; animation: lv-wave 900ms ease-in-out infinite; }
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
                            {parseThrottled && (
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
                        <Check className="h-3.5 w-3.5" style={{ color: "var(--ok)" }} />
                        Consented · encrypted · 30-day retention
                    </div>
                </aside>

                {/* ——— Center canvas ——— */}
                <section className="scroll overflow-y-auto px-6 py-6 md:px-10">
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

                    {/* CC hero */}
                    <div className="mb-5">
                        <div
                            className="text-[10.5px] uppercase"
                            style={{
                                color: "var(--ink-3)",
                                letterSpacing: "0.12em",
                                fontWeight: 600,
                            }}
                        >
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

                    {/* Fields grid */}
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

                    {/* Suggested orders */}
                    <div className="mt-6">
                        <div className="mb-2.5 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
                            <div
                                className="text-[10.5px] uppercase"
                                style={{
                                    color: "var(--ink-3)",
                                    letterSpacing: "0.12em",
                                    fontWeight: 600,
                                }}
                            >
                                AI-suggested orders
                            </div>
                            <div className="flex-1" />
                            <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                                Based on chief complaint · tap to accept
                            </span>
                        </div>
                        {suggestedOrders.size === 0 ? (
                            <div
                                className="rounded-xl p-4 text-center text-[12.5px]"
                                style={{
                                    border: "1px dashed var(--line)",
                                    color: "var(--ink-4)",
                                }}
                            >
                                Suggestions will appear as the clinical picture takes shape…
                            </div>
                        ) : (
                            <div
                                className="grid gap-2.5"
                                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
                            >
                                {Object.entries(SUGGESTED_ORDERS)
                                    .filter(([k]) => suggestedOrders.has(k))
                                    .map(([k, o]) => (
                                        <div
                                            key={k}
                                            className="lv-pop"
                                            style={{
                                                padding: 12,
                                                borderRadius: 10,
                                                border: "1px solid var(--brand-ink)",
                                                background: "var(--brand-soft)",
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Pill tone="accent">{o.t}</Pill>
                                                <div className="flex-1" />
                                                <span
                                                    className="text-[10px] font-semibold"
                                                    style={{
                                                        color: "var(--brand-ink)",
                                                    }}
                                                >
                                                    NEW
                                                </span>
                                            </div>
                                            <div
                                                className="mt-2 text-[14px] font-semibold"
                                                style={{ color: "var(--ink)" }}
                                            >
                                                {o.n}
                                            </div>
                                            <div
                                                className="mt-0.5 text-[11.5px]"
                                                style={{ color: "var(--ink-2)" }}
                                            >
                                                {o.d}
                                            </div>
                                            <div className="mt-2.5 flex gap-1.5">
                                                <Btn
                                                    kind="primary"
                                                    size="sm"
                                                    icon={<Check className="h-3.5 w-3.5" />}
                                                >
                                                    Accept
                                                </Btn>
                                                <Btn kind="plain" size="sm">
                                                    Skip
                                                </Btn>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
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
                                                            textDecoration: done
                                                                ? "line-through"
                                                                : "none",
                                                            textDecorationThickness: "1px",
                                                            textDecorationColor: "var(--ink-4)",
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
