"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { _convertToMP3Internal, preloadLamejs } from "@/app/_lib/utils/audioConverter";
import { storeFile } from "@/app/_lib/offline/files";
import { toast } from "sonner";
import { cn } from "@/app/_lib/utils/cn";

interface AICapturePanelProps {
    patientId: string;
    onTranscriptReady: (transcript: string) => void;
    onParseReady: (parsed: unknown) => void;
}

type CaptureState =
    | "idle"
    | "recording"
    | "converting"
    | "uploading"
    | "transcribing"
    | "parsing"
    | "complete";

export function AICapturePanel({
    patientId,
    onTranscriptReady,
    onParseReady,
}: AICapturePanelProps) {
    const [state, setState] = useState<CaptureState>("idle");
    const [recordingTime, setRecordingTime] = useState(0);
    const [previousTranscripts, setPreviousTranscripts] = useState<string[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        if (navigator.onLine) {
            preloadLamejs().catch((error) => {
                console.warn("Failed to preload lamejs:", error);
            });
        }
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
                await handleAudioBlob(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setState("recording");
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Error starting recording:", error);
            toast.error("Failed to start recording");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            setState("converting");
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleAudioBlob = async (audioBlob: Blob) => {
        try {
            let processedBlob: Blob = audioBlob;
            let fileExtension = "webm";
            let mimeType = audioBlob.type || "audio/webm";

            try {
                processedBlob = await _convertToMP3Internal(audioBlob);
                fileExtension = "mp3";
                mimeType = "audio/mpeg";
            } catch (conversionError: any) {
                console.warn("MP3 conversion failed, using original format:", conversionError);
            }

            const file = new File([processedBlob], `recording-${Date.now()}.${fileExtension}`, {
                type: mimeType,
            });

            let fileId: string | null = null;
            try {
                fileId = await storeFile(file);
            } catch (storeError) {
                console.warn("Failed to store file locally (IndexedDB issue), continuing with upload:", storeError);
            }

            if (!navigator.onLine) {
                try {
                    const { getOfflineDB } = await import("@/app/_lib/offline/db");
                    const db = getOfflineDB();
                    const draft = await db.draftVisits.where("patientId").equals(patientId).first();

                    if (draft && fileId) {
                        await db.draftVisits.update(draft.draftId, {
                            pendingParsing: JSON.stringify({
                                audioFileId: fileId,
                                previousTranscripts: previousTranscripts.length > 0 ? previousTranscripts : undefined,
                                patientId,
                            }),
                        });
                    }
                } catch (offlineError) {
                    console.warn("Failed to save offline draft:", offlineError);
                }
                toast.warning("Connection lost. Audio saved locally.");
                setState("idle");
                return;
            }

            const fallbackId = fileId || `rec-${Date.now()}`;
            const path = `visits/${patientId}/${fallbackId}/${Date.now()}.${fileExtension}`;
            let audioPath: string | null = null;

            try {
                setState("uploading");
                const uploadFormData = new FormData();
                uploadFormData.append("file", processedBlob, `recording-${Date.now()}.${fileExtension}`);
                uploadFormData.append("path", path);

                const uploadResponse = await fetch("/api/upload/audio", {
                    method: "POST",
                    body: uploadFormData,
                });

                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    audioPath = uploadData.path || path;
                } else {
                    throw new Error("Upload failed");
                }
            } catch (uploadError) {
                toast.warning("Upload failed. Audio saved locally.");
                setState("idle");
                return;
            }

            try {
                setState("transcribing");
                const parseResponse = await fetch("/api/ai/parse-audio-openrouter", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        audioPath,
                        previousTranscripts: previousTranscripts.length > 0 ? previousTranscripts : undefined,
                    }),
                });

                if (!parseResponse.ok) throw new Error("Processing failed");

                const { parsed, transcript: newTranscript } = await parseResponse.json();

                if (newTranscript && newTranscript.trim().length > 0) {
                    onTranscriptReady(newTranscript);
                    setPreviousTranscripts((prev) => [...prev, newTranscript]);
                }
                onParseReady(parsed);

                setState("complete");
                toast.success("AI notes generated successfully");

                setTimeout(() => {
                    setState("idle");
                }, 2000);
            } catch (processError) {
                toast.warning("Processing failed. Audio saved offline.");
                setState("idle");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to process audio");
            setState("idle");
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const isProcessing = ["converting", "uploading", "transcribing", "parsing"].includes(state);

    return (
        <div className="fixed bottom-24 right-8 z-[100] group">
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-4 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none md:origin-bottom-right border border-slate-700 font-medium">
                AI Clinical Scribe
                <div className="absolute -bottom-2 right-6 w-0 h-0 border-l-[6px] border-l-transparent border-t-[8px] border-t-slate-800 border-r-[6px] border-r-transparent"></div>
            </div>

            {/* Background Glow / Pulse logic */}
            {state === "recording" && (
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
            )}
            
            <Button
                onClick={state === "recording" ? stopRecording : startRecording}
                disabled={isProcessing}
                size="icon"
                className={cn(
                    "relative h-14 w-14 rounded-full border-4 border-white dark:border-slate-800 overflow-hidden transition-all duration-300",
                    state === "recording" 
                        ? "bg-red-500 hover:bg-red-600 scale-105" 
                        : isProcessing 
                            ? "bg-slate-700 opacity-90 cursor-wait"
                            : "bg-slate-900 hover:bg-slate-800 hover:scale-105"
                )}
            >
                {state === "recording" ? (
                    <div className="flex flex-col items-center gap-0.5">
                        <Square className="h-4 w-4 fill-current text-white" />
                        <span className="text-[9px] text-white font-bold tracking-wider">{formatTime(recordingTime)}</span>
                    </div>
                ) : isProcessing ? (
                    <div className="flex flex-col items-center gap-0.5">
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                        <span className="text-[9px] text-white font-bold px-1">WAIT</span>
                    </div>
                ) : (
                    <Mic className="h-6 w-6 text-white" />
                )}
            </Button>
        </div>
    );
}

