"use client";

import type { LiveSpeechSnapshot } from "./live-speech";

export interface SrtCue {
    index: number;
    startMs: number;
    endMs: number;
    text: string;
}

export interface SrtSimulatorOptions {
    /**
     * How fast to replay the cues. 1 = real-time; 4 = 4x. Useful for demos so
     * a 15-minute SRT finishes in a few minutes.
     */
    speed?: number;
    onSnapshot: (snapshot: LiveSpeechSnapshot) => void;
    onStateChange?: (state: "idle" | "listening" | "stopped") => void;
    onProgress?: (current: number, total: number) => void;
}

export interface SrtSimulator {
    start: () => void;
    stop: () => Promise<LiveSpeechSnapshot>;
    destroy: () => void;
}

/**
 * Parse an SRT file into cues. Tolerates both `\r\n` and `\n` line endings
 * and multi-line subtitle text blocks.
 */
export function parseSrt(raw: string): SrtCue[] {
    const text = raw.replace(/\r\n/g, "\n").trim();
    const blocks = text.split(/\n{2,}/);
    const cues: SrtCue[] = [];
    for (const block of blocks) {
        const lines = block.split("\n");
        if (lines.length < 2) continue;
        const idx = Number.parseInt(lines[0].trim(), 10);
        const timing = lines[1];
        const match = timing.match(
            /(\d\d):(\d\d):(\d\d)[,.](\d\d\d)\s*-->\s*(\d\d):(\d\d):(\d\d)[,.](\d\d\d)/
        );
        if (!match) continue;
        const startMs =
            (+match[1] * 3600 + +match[2] * 60 + +match[3]) * 1000 + +match[4];
        const endMs =
            (+match[5] * 3600 + +match[6] * 60 + +match[7]) * 1000 + +match[8];
        const cueText = lines.slice(2).join(" ").trim();
        if (!cueText) continue;
        cues.push({
            index: Number.isFinite(idx) ? idx : cues.length + 1,
            startMs,
            endMs,
            text: cueText,
        });
    }
    return cues;
}

export async function fetchSrt(path: string): Promise<SrtCue[]> {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Failed to fetch SRT: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    return parseSrt(text);
}

/**
 * Replay parsed SRT cues as if they were arriving from a speech recognizer —
 * every cue becomes an `appendedFinalTranscript` emission. Gaps between
 * cues are compressed by `speed`, and anything longer than a short ceiling
 * is clamped so dead-air sections of the video don't pause the demo.
 */
export function createSrtSimulator(
    cues: SrtCue[],
    options: SrtSimulatorOptions
): SrtSimulator {
    const speed = Math.max(0.5, options.speed ?? 2);
    // Minimum gap between cues so a string of short back-to-back lines in
    // the SRT doesn't fire faster than the user can read or the AI parse
    // loop can keep up with.
    const minGapMs = 600;
    // Clamp abnormally long dead-air sections in the source (e.g. the
    // intro monologue gap) so the demo doesn't appear stuck.
    const maxGapMs = 3500;
    let cancelled = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finalSegments: string[] = [];
    let currentIdx = 0;

    const emit = (appended = "", interim = "") => {
        const finalTranscript = finalSegments.join(" ").trim();
        options.onSnapshot({
            finalTranscript,
            interimTranscript: interim.trim(),
            fullTranscript: [finalTranscript, interim.trim()]
                .filter(Boolean)
                .join(" ")
                .trim(),
            appendedFinalTranscript: appended.trim(),
        });
    };

    const scheduleNext = () => {
        if (cancelled || currentIdx >= cues.length) {
            running = false;
            options.onStateChange?.("stopped");
            return;
        }

        const cue = cues[currentIdx];
        const prev = cues[currentIdx - 1];
        // Gap between end of previous cue and start of this one, scaled by
        // speed and clamped so short consecutive cues don't fire faster than
        // the user can follow / the AI parse cadence.
        const rawGap = prev ? cue.startMs - prev.endMs : cue.startMs;
        const scaled = Math.min(Math.max(rawGap, 0), maxGapMs) / speed;
        const gap = Math.max(scaled, minGapMs);

        timer = setTimeout(() => {
            if (cancelled) return;
            finalSegments.push(cue.text);
            emit(cue.text);
            options.onProgress?.(currentIdx + 1, cues.length);
            currentIdx += 1;
            scheduleNext();
        }, gap);
    };

    return {
        start: () => {
            if (running) return;
            running = true;
            currentIdx = 0;
            finalSegments.length = 0;
            cancelled = false;
            options.onStateChange?.("listening");
            // Prime an empty snapshot so the UI clears any previous state.
            emit("");
            scheduleNext();
        },
        stop: async () => {
            cancelled = true;
            running = false;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            options.onStateChange?.("stopped");
            return {
                finalTranscript: finalSegments.join(" ").trim(),
                interimTranscript: "",
                fullTranscript: finalSegments.join(" ").trim(),
                appendedFinalTranscript: "",
            };
        },
        destroy: () => {
            cancelled = true;
            running = false;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        },
    };
}
