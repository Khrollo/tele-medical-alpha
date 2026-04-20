"use client";

import * as React from "react";

export type MicPermission = "unknown" | "prompt" | "granted" | "denied";

export interface AudioDevice {
    deviceId: string;
    label: string;
    groupId: string;
}

export interface CalibrationResult {
    deviceId: string;
    deviceLabel: string;
    noiseFloorDb: number;
    peakDb: number;
    sampleRate: number;
    savedAt: number;
}

const STORAGE_KEY = "live-visit:calibration:v1";
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function dbFromRms(rms: number): number {
    if (rms <= 0) return -100;
    return 20 * Math.log10(rms);
}

function computeRms(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
        sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
}

function levelFromDb(db: number): number {
    // Map dBFS [-60..0] → [0..1] for a UI bar
    if (db <= -60) return 0;
    if (db >= 0) return 1;
    return (db + 60) / 60;
}

/**
 * Close an AudioContext at most once. Calling `.close()` on a context that
 * is already closed throws `InvalidStateError`, which surfaces in Next's
 * runtime error overlay even though we don't care about the result.
 */
function safeCloseContext(ctx: AudioContext): void {
    if (ctx.state === "closed") return;
    try {
        void ctx.close();
    } catch {
        // ignore
    }
}

export function useMicPermission(): {
    permission: MicPermission;
    request: () => Promise<MediaStream | null>;
    error: string | null;
} {
    const [permission, setPermission] = React.useState<MicPermission>("unknown");
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (typeof navigator === "undefined" || !navigator.permissions) {
            setPermission("unknown");
            return;
        }
        // Permissions API microphone query is not fully supported in Safari; wrap in try.
        let cancelled = false;
        (async () => {
            try {
                const status = await navigator.permissions.query({
                    name: "microphone" as PermissionName,
                });
                if (cancelled) return;
                setPermission(status.state as MicPermission);
                status.onchange = () => {
                    if (!cancelled) setPermission(status.state as MicPermission);
                };
            } catch {
                setPermission("unknown");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const request = React.useCallback(async (): Promise<MediaStream | null> => {
        setError(null);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setError("This browser does not support microphone access.");
            setPermission("denied");
            return null;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            setPermission("granted");
            return stream;
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Microphone access was denied.";
            setError(message);
            setPermission("denied");
            return null;
        }
    }, []);

    return { permission, request, error };
}

export function useDeviceList(permissionGranted: boolean): {
    devices: AudioDevice[];
    refresh: () => Promise<void>;
} {
    const [devices, setDevices] = React.useState<AudioDevice[]>([]);

    const refresh = React.useCallback(async () => {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
            setDevices([]);
            return;
        }
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const inputs = list
                .filter((d) => d.kind === "audioinput")
                .map((d) => ({
                    deviceId: d.deviceId,
                    label: d.label || "Microphone",
                    groupId: d.groupId,
                }));
            setDevices(inputs);
        } catch {
            setDevices([]);
        }
    }, []);

    React.useEffect(() => {
        if (!permissionGranted) return;
        void refresh();
        const listener = () => void refresh();
        navigator.mediaDevices?.addEventListener?.("devicechange", listener);
        return () => {
            navigator.mediaDevices?.removeEventListener?.("devicechange", listener);
        };
    }, [permissionGranted, refresh]);

    return { devices, refresh };
}

interface LevelMeterSample {
    level: number; // 0..1 for UI
    db: number; // raw dBFS
    peak: number; // peak dBFS over sampling window
}

export function useLevelMeter(stream: MediaStream | null): LevelMeterSample {
    const [sample, setSample] = React.useState<LevelMeterSample>({
        level: 0,
        db: -100,
        peak: -100,
    });

    React.useEffect(() => {
        if (!stream || typeof window === "undefined") return;

        const AudioCtor: typeof AudioContext | undefined =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;

        if (!AudioCtor) return;
        const ctx = new AudioCtor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);
        let rafId = 0;
        let peak = -100;
        let peakDecayAt = Date.now();

        const tick = () => {
            analyser.getFloatTimeDomainData(buffer);
            const rms = computeRms(buffer);
            const db = dbFromRms(rms);
            if (db > peak) peak = db;
            const now = Date.now();
            if (now - peakDecayAt > 250) {
                peak = Math.max(-100, peak - 1.5);
                peakDecayAt = now;
            }
            setSample({ level: levelFromDb(db), db, peak });
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafId);
            try {
                source.disconnect();
            } catch {
                // ignore
            }
            safeCloseContext(ctx);
        };
    }, [stream]);

    return sample;
}

export type NoiseFloorState =
    | { status: "idle" }
    | { status: "measuring"; progress: number }
    | { status: "done"; noiseFloorDb: number }
    | { status: "error"; error: string };

export function useNoiseFloor(stream: MediaStream | null, durationMs = 3000): {
    state: NoiseFloorState;
    start: () => void;
    reset: () => void;
} {
    const [state, setState] = React.useState<NoiseFloorState>({ status: "idle" });
    const cancelRef = React.useRef<(() => void) | null>(null);

    const start = React.useCallback(() => {
        if (!stream || typeof window === "undefined") {
            setState({ status: "error", error: "Microphone stream not available." });
            return;
        }
        const AudioCtor: typeof AudioContext | undefined =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
        if (!AudioCtor) {
            setState({ status: "error", error: "Web Audio not supported." });
            return;
        }
        const ctx = new AudioCtor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        const samples: number[] = [];
        const startedAt = Date.now();
        let cancelled = false;
        let rafId = 0;

        const tick = () => {
            if (cancelled) return;
            analyser.getFloatTimeDomainData(buffer);
            const rms = computeRms(buffer);
            const db = dbFromRms(rms);
            samples.push(db);
            const elapsed = Date.now() - startedAt;
            const progress = Math.min(1, elapsed / durationMs);
            setState({ status: "measuring", progress });
            if (elapsed >= durationMs) {
                samples.sort((a, b) => a - b);
                // Use the 50th percentile (median) to avoid being thrown off
                // by cough/spike noise during calibration.
                const median = samples[Math.floor(samples.length * 0.5)] ?? -60;
                setState({ status: "done", noiseFloorDb: median });
                try {
                    source.disconnect();
                } catch {
                    // ignore
                }
                safeCloseContext(ctx);
                return;
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        cancelRef.current = () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
            try {
                source.disconnect();
            } catch {
                // ignore
            }
            safeCloseContext(ctx);
        };
    }, [stream, durationMs]);

    const reset = React.useCallback(() => {
        cancelRef.current?.();
        cancelRef.current = null;
        setState({ status: "idle" });
    }, []);

    React.useEffect(() => {
        return () => cancelRef.current?.();
    }, []);

    return { state, start, reset };
}

export function loadCalibration(): CalibrationResult | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CalibrationResult;
        if (!parsed.deviceId || typeof parsed.noiseFloorDb !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveCalibration(result: CalibrationResult): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
        // ignore
    }
}

export function clearCalibration(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}

export function isCalibrationStale(cal: CalibrationResult | null, currentDeviceId?: string): boolean {
    if (!cal) return true;
    if (Date.now() - cal.savedAt > STALE_MS) return true;
    if (currentDeviceId && currentDeviceId !== cal.deviceId) return true;
    return false;
}

export async function pingParseEndpoint(): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch("/api/ai/parse-visit/ping", {
            method: "GET",
            cache: "no-store",
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!json.ok) return { ok: false, error: json.error || "Endpoint not ready" };
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : "Network error",
        };
    }
}

export function supportsLiveCapture(): { ok: boolean; missing: string[] } {
    if (typeof window === "undefined") return { ok: false, missing: ["window"] };
    const missing: string[] = [];
    if (!window.AudioContext && !(window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) {
        missing.push("Web Audio");
    }
    if (!navigator.mediaDevices?.getUserMedia) missing.push("getUserMedia");
    if (typeof window.MediaRecorder === "undefined") missing.push("MediaRecorder");
    const hasSpeech =
        (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!hasSpeech) missing.push("SpeechRecognition");
    return { ok: missing.length === 0, missing };
}

export function formatDbLabel(db: number): string {
    if (db <= -60) return "Silent";
    if (db <= -40) return "Quiet";
    if (db <= -20) return "Speaking";
    if (db <= -10) return "Loud";
    return "Very loud";
}
