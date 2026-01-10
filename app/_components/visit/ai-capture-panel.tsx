"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Mic, Upload, Loader2, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { _convertToMP3Internal } from "@/app/_lib/utils/audioConverter";
import { storeFile } from "@/app/_lib/offline/files";
import { toast } from "sonner";

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
    const [activeTab, setActiveTab] = useState<"record" | "upload">("record");
    const [state, setState] = useState<CaptureState>("idle");
    const [progress, setProgress] = useState(0);
    const [recordingTime, setRecordingTime] = useState(0);
    const [transcript, setTranscript] = useState<string | null>(null);
    const [previousTranscripts, setPreviousTranscripts] = useState<string[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Recording functions
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

            // Start timer
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("audio/")) {
            toast.error("Please select an audio file");
            return;
        }

        setState("converting");
        const audioBlob = new Blob([file], { type: file.type });
        await handleAudioBlob(audioBlob);
    };

    const handleAudioBlob = async (audioBlob: Blob) => {
        try {
            setProgress(20);

            // Convert to MP3
            const mp3Blob = await _convertToMP3Internal(audioBlob);
            setProgress(40);

            // Store file locally
            const file = new File([mp3Blob], `recording-${Date.now()}.mp3`, {
                type: "audio/mpeg",
            });
            const fileId = await storeFile(file);
            setProgress(60);

            // Upload to Supabase Storage via server endpoint (bypasses RLS)
            setState("uploading");
            const path = `visits/${patientId}/${fileId}/${Date.now()}.mp3`;

            const uploadFormData = new FormData();
            uploadFormData.append("file", mp3Blob, `recording-${Date.now()}.mp3`);
            uploadFormData.append("path", path);

            const uploadResponse = await fetch("/api/upload/audio", {
                method: "POST",
                body: uploadFormData,
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.error || "Upload failed");
            }

            const uploadData = await uploadResponse.json();
            // Use the path from the upload response (this is the path within the bucket)
            const audioPath = uploadData.path || path;

            console.log("Upload response:", uploadData);
            console.log("Using audio path for transcription:", audioPath);

            setProgress(80);

            // Transcribe
            setState("transcribing");
            const transcribeResponse = await fetch("/api/ai/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audioPath }),
            });

            if (!transcribeResponse.ok) {
                const error = await transcribeResponse.json();
                throw new Error(error.error || "Transcription failed");
            }

            const { text: newTranscript, rawText } = await transcribeResponse.json();
            if (!newTranscript) {
                throw new Error("Transcription returned empty result");
            }
            setTranscript(newTranscript);
            onTranscriptReady(newTranscript);
            setProgress(90);

            // Parse with previous transcripts as context
            setState("parsing");
            const parseResponse = await fetch("/api/ai/parse-visit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transcript: newTranscript,
                    previousTranscripts: previousTranscripts.length > 0 ? previousTranscripts : undefined,
                }),
            });

            if (!parseResponse.ok) {
                const error = await parseResponse.json();
                throw new Error(error.error || "Parsing failed");
            }

            const { parsed } = await parseResponse.json();
            onParseReady(parsed);

            // Add new transcript to previous transcripts for next recording
            setPreviousTranscripts((prev) => [...prev, newTranscript]);

            setProgress(100);
            setState("complete");

            toast.success("Audio processed successfully");

            // Reset state after a short delay to allow recording again
            setTimeout(() => {
                setState("idle");
                setProgress(0);
            }, 2000);
        } catch (error) {
            console.error("Error processing audio:", error);
            toast.error(error instanceof Error ? error.message : "Processing failed");
            setState("idle");
            setProgress(0);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>AI Capture</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "record" | "upload")}>


                    <TabsContent value="record" className="space-y-4">
                        <div className="flex flex-col items-center gap-4">
                            {state === "recording" ? (
                                <>
                                    <div className="text-center">
                                        <div className="text-2xl font-mono">{formatTime(recordingTime)}</div>
                                        <div className="text-sm text-muted-foreground">Recording...</div>
                                    </div>
                                    <Button onClick={stopRecording} variant="destructive" size="lg">
                                        <Mic className="h-4 w-4 mr-2" />
                                        Stop Recording
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    onClick={startRecording}
                                    size="lg"
                                    disabled={state !== "idle" && state !== "complete"}
                                >
                                    <Mic className="h-4 w-4 mr-2" />
                                    {previousTranscripts.length > 0 ? "Record Again" : "Start Recording"}
                                </Button>
                            )}
                        </div>
                    </TabsContent>


                </Tabs>

                {state !== "idle" && state !== "complete" && (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                {state === "converting" && "Converting to MP3..."}
                                {state === "uploading" && "Uploading..."}
                                {state === "transcribing" && "Transcribing..."}
                                {state === "parsing" && "Parsing transcript..."}
                            </span>
                            <span className="text-muted-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} />
                    </div>
                )}

                {transcript && state === "complete" && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                        <div className="text-sm font-medium mb-2">Transcript:</div>
                        <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                            {transcript}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

