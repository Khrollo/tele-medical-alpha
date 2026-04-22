"use client";

import type { LiveSpeechSnapshot } from "./live-speech";

export interface DeepgramSegment {
    text: string;
    speaker: number;
    isFinal: boolean;
    startMs: number;
    endMs: number;
}

export interface DeepgramControllerOptions {
    onStateChange?: (state: "idle" | "listening" | "stopped" | "unsupported") => void;
    onSnapshot: (snapshot: LiveSpeechSnapshot & { speaker?: number }) => void;
    onError?: (message: string) => void;
    /** Called when an ephemeral token expires and we need a new one. */
    refreshToken?: () => Promise<string | null>;
    /**
     * Optional pre-built audio source. When provided, the controller will NOT
     * call getUserMedia and will instead encode this stream. Use this to
     * transcribe a mixed Twilio room stream so both clinician and patient
     * audio appear in the live captions. We accept either a stream or a
     * factory because mixed streams are typically built lazily once the
     * remote participants are connected.
     */
    audioStream?: MediaStream | (() => Promise<MediaStream | null>);
    /**
     * If true (default), `stop()` will end the underlying MediaStream tracks.
     * Set to false when the caller owns the stream lifecycle (e.g. the
     * call-recorder owns the mixed Twilio stream and stops it elsewhere).
     */
    ownsStream?: boolean;
}

export interface DeepgramController {
    isSupported: boolean;
    start: () => Promise<void>;
    stop: () => Promise<LiveSpeechSnapshot>;
    destroy: () => void;
}

/**
 * Wrap the Deepgram streaming WebSocket so it's drop-in compatible with the
 * existing live-speech snapshot shape. Only lifts to tier-1 when
 * NEXT_PUBLIC_STT_PROVIDER=deepgram is set AND the token endpoint returns
 * a key — otherwise callers should fall back to live-speech.ts (Web Speech).
 */
export function createDeepgramController(
    options: DeepgramControllerOptions
): DeepgramController {
    if (typeof window === "undefined") {
        return {
            isSupported: false,
            start: async () => undefined,
            stop: async () => ({
                finalTranscript: "",
                interimTranscript: "",
                fullTranscript: "",
                appendedFinalTranscript: "",
            }),
            destroy: () => undefined,
        };
    }

    let ws: WebSocket | null = null;
    let mediaStream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let finalSegments: string[] = [];
    let interim = "";
    let stoppedExpected = false;

    const emit = (appended = "", interimText = interim) => {
        const finalTranscript = finalSegments.join(" ").trim();
        options.onSnapshot({
            finalTranscript,
            interimTranscript: interimText.trim(),
            fullTranscript: [finalTranscript, interimText.trim()]
                .filter(Boolean)
                .join(" ")
                .trim(),
            appendedFinalTranscript: appended.trim(),
        });
    };

    async function fetchToken(): Promise<string | null> {
        if (options.refreshToken) return options.refreshToken();
        try {
            const res = await fetch("/api/deepgram/token", { method: "POST" });
            if (!res.ok) return null;
            const json = (await res.json()) as { key?: string };
            return json.key ?? null;
        } catch {
            return null;
        }
    }

    async function openSocket(): Promise<void> {
        const key = await fetchToken();
        if (!key) {
            options.onStateChange?.("unsupported");
            options.onError?.("Deepgram not configured");
            throw new Error("no-deepgram-token");
        }
        const params = new URLSearchParams({
            model: "nova-3-medical",
            interim_results: "true",
            smart_format: "true",
            punctuate: "true",
            diarize: "true",
            endpointing: "300",
            encoding: "opus",
            sample_rate: "48000",
            language: "en-US",
        });

        ws = new WebSocket(
            `wss://api.deepgram.com/v1/listen?${params.toString()}`,
            ["token", key]
        );

        ws.onopen = () => {
            options.onStateChange?.("listening");
        };

        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data as string) as {
                    type?: string;
                    channel?: {
                        alternatives?: Array<{
                            transcript?: string;
                            words?: Array<{ speaker?: number }>;
                        }>;
                    };
                    is_final?: boolean;
                };
                if (data.type !== "Results") return;
                const alt = data.channel?.alternatives?.[0];
                const text = alt?.transcript?.trim() ?? "";
                if (!text) return;
                const speaker = alt?.words?.[0]?.speaker;
                if (data.is_final) {
                    finalSegments = [...finalSegments, text];
                    interim = "";
                    options.onSnapshot({
                        finalTranscript: finalSegments.join(" ").trim(),
                        interimTranscript: "",
                        fullTranscript: finalSegments.join(" ").trim(),
                        appendedFinalTranscript: text,
                        speaker,
                    });
                } else {
                    interim = text;
                    emit("", interim);
                }
            } catch (err) {
                options.onError?.(
                    err instanceof Error ? err.message : "Deepgram parse error"
                );
            }
        };

        ws.onerror = () => {
            options.onError?.("Deepgram socket error");
        };

        ws.onclose = () => {
            if (!stoppedExpected) {
                options.onError?.("Deepgram socket closed unexpectedly");
            }
            options.onStateChange?.("stopped");
        };
    }

    const ownsStream = options.ownsStream ?? !options.audioStream;

    async function resolveStream(): Promise<MediaStream> {
        if (options.audioStream) {
            const candidate =
                typeof options.audioStream === "function"
                    ? await options.audioStream()
                    : options.audioStream;
            if (!candidate) {
                throw new Error("Provided audioStream resolved to null");
            }
            return candidate;
        }
        return navigator.mediaDevices.getUserMedia({ audio: true });
    }

    async function startRecorder(): Promise<void> {
        mediaStream = await resolveStream();
        const mimeType = "audio/webm;codecs=opus";
        if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported?.(mimeType)) {
            throw new Error("MediaRecorder/opus not supported");
        }
        recorder = new MediaRecorder(mediaStream, { mimeType });
        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
                e.data.arrayBuffer().then((buf) => ws?.send(buf));
            }
        };
        // 250ms timeslice keeps the perceived latency under ~400ms end-to-end
        // (250ms slice + ~100ms encode/upload + ~50ms Deepgram inference).
        recorder.start(250);
    }

    return {
        isSupported: true,
        start: async () => {
            stoppedExpected = false;
            finalSegments = [];
            interim = "";
            await openSocket();
            await startRecorder();
        },
        stop: async () => {
            stoppedExpected = true;
            try {
                recorder?.stop();
            } catch {
                // ignore
            }
            recorder = null;
            // Only end tracks we created ourselves. Stopping a caller-owned
            // stream here would silently kill the call recorder's mixed
            // stream and stop the Twilio recording mid-visit.
            if (ownsStream) {
                mediaStream?.getTracks().forEach((t) => t.stop());
            }
            mediaStream = null;
            try {
                ws?.send(JSON.stringify({ type: "CloseStream" }));
            } catch {
                // ignore
            }
            try {
                ws?.close();
            } catch {
                // ignore
            }
            ws = null;
            return {
                finalTranscript: finalSegments.join(" ").trim(),
                interimTranscript: "",
                fullTranscript: finalSegments.join(" ").trim(),
                appendedFinalTranscript: "",
            };
        },
        destroy: () => {
            stoppedExpected = true;
            try {
                recorder?.stop();
            } catch {
                // ignore
            }
            recorder = null;
            if (ownsStream) {
                mediaStream?.getTracks().forEach((t) => t.stop());
            }
            mediaStream = null;
            try {
                ws?.close();
            } catch {
                // ignore
            }
            ws = null;
        },
    };
}

export function isDeepgramConfigured(): boolean {
    // Client-side only sees NEXT_PUBLIC_* envs. Actual configuration is
    // validated server-side when the token endpoint is hit — this is just
    // a hint so the orchestrator can skip attempting tier-1.
    if (typeof window === "undefined") return false;
    return process.env.NEXT_PUBLIC_STT_PROVIDER === "deepgram";
}
