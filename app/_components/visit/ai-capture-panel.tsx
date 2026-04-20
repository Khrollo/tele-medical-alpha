"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Mic, Loader2, Square, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  _convertToMP3Internal,
  preloadLamejs,
} from "@/app/_lib/utils/audioConverter";
import { storeFile } from "@/app/_lib/offline/files";
import { toast } from "sonner";
import { cn } from "@/app/_lib/utils/cn";
import {
  createLiveSpeechController,
  isLiveSpeechSupported,
  type LiveSpeechSnapshot,
} from "@/app/_lib/ai/live-speech";
import { parseTranscriptDraftAction } from "@/app/_actions/visits";

type CaptureState =
  | "idle"
  | "recording"
  | "converting"
  | "uploading"
  | "transcribing"
  | "complete";

export interface AICaptureLiveState {
  liveTranscript: string;
  interimTranscript: string;
  isCapturing: boolean;
  recordingTime: number;
  state: CaptureState;
}

interface AICapturePanelProps {
  patientId: string;
  onTranscriptReady: (transcript: string) => void;
  onParseReady: (parsed: unknown) => void;
  onLiveState?: (state: AICaptureLiveState) => void;
  hideLiveDraftBubble?: boolean;
}

const LIVE_PARSE_INTERVAL_MS = 5000;

export function AICapturePanel({
  patientId,
  onTranscriptReady,
  onParseReady,
  onLiveState,
  hideLiveDraftBubble,
}: AICapturePanelProps) {
  const [state, setState] = useState<CaptureState>("idle");
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [previousTranscripts, setPreviousTranscripts] = useState<string[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isLiveMode, setIsLiveMode] = useState(isLiveSpeechSupported());
  const [isLiveParsing, setIsLiveParsing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const parseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastParsedTranscriptRef = useRef("");
  const latestFullTranscriptRef = useRef("");
  const liveControllerRef = useRef<ReturnType<typeof createLiveSpeechController> | null>(null);
  const previousTranscriptsRef = useRef<string[]>([]);
  const isLiveParsingRef = useRef(false);
  const isLiveSessionActiveRef = useRef(false);

  const queuePendingParsing = React.useCallback(
    async (audioFileId: string | null) => {
      if (!audioFileId) {
        return;
      }

      try {
        const { getOfflineDB } = await import("@/app/_lib/offline/db");
        const db = getOfflineDB();
        const draft = await db.draftVisits.where("patientId").equals(patientId).first();

        if (!draft) {
          return;
        }

        await db.draftVisits.update(draft.draftId, {
          pendingParsing: JSON.stringify({
            audioFileId,
            previousTranscripts:
              previousTranscriptsRef.current.length > 0
                ? previousTranscriptsRef.current
                : undefined,
            patientId,
          }),
        });
      } catch (offlineError) {
        console.warn("Failed to queue pending parsing:", offlineError);
      }
    },
    [patientId]
  );

  const runLiveParse = React.useCallback(
    async (transcript: string) => {
      const normalized = transcript.trim();
      if (
        !normalized ||
        normalized === lastParsedTranscriptRef.current ||
        isLiveParsingRef.current
      ) {
        return;
      }

      isLiveParsingRef.current = true;
      setIsLiveParsing(true);

      try {
        const result = await parseTranscriptDraftAction({
          transcript: normalized,
          previousTranscripts: previousTranscriptsRef.current,
        });

        onParseReady(result.parsed);
        lastParsedTranscriptRef.current = normalized;
      } catch (error) {
        console.error("Error parsing live transcript:", error);
      } finally {
        isLiveParsingRef.current = false;
        setIsLiveParsing(false);
      }
    },
    [onParseReady]
  );

  const startLiveParseLoop = React.useCallback(() => {
    if (parseIntervalRef.current) {
      return;
    }

    parseIntervalRef.current = setInterval(() => {
      if (!isLiveSessionActiveRef.current || isLiveParsingRef.current) {
        return;
      }

      const transcript = latestFullTranscriptRef.current.trim();
      if (!transcript || transcript === lastParsedTranscriptRef.current) {
        return;
      }

      void runLiveParse(transcript);
    }, LIVE_PARSE_INTERVAL_MS);
  }, [runLiveParse]);

  const stopLiveParseLoop = React.useCallback(() => {
    if (parseIntervalRef.current) {
      clearInterval(parseIntervalRef.current);
      parseIntervalRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    previousTranscriptsRef.current = previousTranscripts;
  }, [previousTranscripts]);

  React.useEffect(() => {
    onLiveState?.({
      liveTranscript,
      interimTranscript,
      isCapturing,
      recordingTime,
      state,
    });
  }, [liveTranscript, interimTranscript, isCapturing, recordingTime, state, onLiveState]);

  React.useEffect(() => {
    if (navigator.onLine) {
      preloadLamejs().catch((error) => {
        console.warn("Failed to preload lamejs:", error);
      });
    }
  }, []);

  const handleLiveSnapshot = React.useCallback(
    async (snapshot: LiveSpeechSnapshot) => {
      latestFullTranscriptRef.current = snapshot.fullTranscript;
      setLiveTranscript(snapshot.finalTranscript);
      setInterimTranscript(snapshot.interimTranscript);

      if (snapshot.appendedFinalTranscript) {
        onTranscriptReady(snapshot.fullTranscript);
        setPreviousTranscripts((prev) => [...prev, snapshot.appendedFinalTranscript]);
      }
    },
    [onTranscriptReady]
  );

  React.useEffect(() => {
    liveControllerRef.current = createLiveSpeechController({
      onStateChange: (nextState) => {
        if (nextState === "listening") {
          setState("recording");
          setIsCapturing(true);
          return;
        }
        if (nextState === "stopped") {
          setIsCapturing(false);
        }
      },
      onSnapshot: (snapshot) => {
        handleLiveSnapshot(snapshot).catch((error) => {
          console.error("Live transcript handling failed:", error);
        });
      },
      onError: (message) => {
        isLiveSessionActiveRef.current = false;
        stopLiveParseLoop();
        setIsCapturing(false);
        setIsLiveMode(false);
        toast.warning(
          message || "Live speech is unavailable. Falling back to recorded audio."
        );
      },
    });

    return () => {
      isLiveSessionActiveRef.current = false;
      liveControllerRef.current?.destroy();
      stopLiveParseLoop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [handleLiveSnapshot, stopLiveParseLoop]);

  const startFallbackRecording = async () => {
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
  };

  const startRecording = async () => {
    try {
      setIsCapturing(true);
      setRecordingTime(0);
      setLiveTranscript("");
      setInterimTranscript("");
      setIsLiveParsing(false);
      latestFullTranscriptRef.current = "";
      lastParsedTranscriptRef.current = "";

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      if (isLiveMode && liveControllerRef.current?.isSupported) {
        isLiveSessionActiveRef.current = true;
        startLiveParseLoop();
        await liveControllerRef.current.start();
        return;
      }

      await startFallbackRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording");
      setState("idle");
      setIsCapturing(false);
      stopLiveParseLoop();
      isLiveSessionActiveRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const stopRecording = async () => {
    setIsCapturing(false);

    if (liveControllerRef.current?.isSupported && isLiveMode) {
      isLiveSessionActiveRef.current = false;
      liveControllerRef.current.stop();
      stopLiveParseLoop();
      await runLiveParse(latestFullTranscriptRef.current);
      setState("complete");
      setTimeout(() => setState("idle"), 1200);
    } else if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
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
      } catch (conversionError: unknown) {
        console.warn(
          "MP3 conversion failed, using original format:",
          conversionError
        );
      }

      const file = new File(
        [processedBlob],
        `recording-${Date.now()}.${fileExtension}`,
        {
          type: mimeType,
        }
      );

      let fileId: string | null = null;
      try {
        fileId = await storeFile(file);
      } catch (storeError) {
        console.warn(
          "Failed to store file locally (IndexedDB issue), continuing with upload:",
          storeError
        );
      }

      if (!navigator.onLine) {
        await queuePendingParsing(fileId);
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
        uploadFormData.append(
          "file",
          processedBlob,
          `recording-${Date.now()}.${fileExtension}`
        );
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
      } catch {
        await queuePendingParsing(fileId);
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
            previousTranscripts:
              previousTranscriptsRef.current.length > 0
                ? previousTranscriptsRef.current
                : undefined,
          }),
        });

        if (!parseResponse.ok) {
          throw new Error("Processing failed");
        }

        const { parsed, transcript: newTranscript } = await parseResponse.json();

        if (newTranscript && newTranscript.trim().length > 0) {
          onTranscriptReady(newTranscript);
          setPreviousTranscripts((prev) => [...prev, newTranscript]);
          setLiveTranscript((prev) =>
            [prev, newTranscript].filter(Boolean).join(" ").trim()
          );
        }
        onParseReady(parsed);

        setState("complete");
        toast.success("AI notes generated successfully");

        setTimeout(() => {
          setState("idle");
        }, 2000);
      } catch {
        await queuePendingParsing(fileId);
        toast.warning("Processing failed. Audio saved offline.");
        setState("idle");
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process audio"
      );
      setState("idle");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isProcessing = ["converting", "uploading", "transcribing"].includes(state);

  return (
    <div className="fixed bottom-24 right-8 z-[100] group flex flex-col items-end gap-3">
      {(liveTranscript || interimTranscript) && !hideLiveDraftBubble && (
        <div
          className="pointer-events-none max-w-sm rounded-[14px] px-4 py-3 text-sm"
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            boxShadow: "0 24px 60px -24px oklch(0 0 0 / 0.25)",
          }}
        >
          <div
            className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
          >
            <AudioLines className="h-3.5 w-3.5" style={{ color: "var(--brand-ink)" }} />
            {isLiveParsing ? "Live AI draft · updating" : "Live AI draft"}
          </div>
          <p className="text-[13px] leading-5" style={{ color: "var(--ink)" }}>
            {liveTranscript || (
              <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>Listening…</span>
            )}
            {interimTranscript && (
              <span style={{ color: "var(--ink-3)" }}> {interimTranscript}</span>
            )}
          </p>
        </div>
      )}

      <div
        className="absolute bottom-full right-0 mb-4 px-3 py-1.5 text-[12px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none md:origin-bottom-right font-medium"
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          border: "1px solid var(--line-strong)",
        }}
      >
        {isLiveMode
          ? isLiveParsing
            ? "AI Clinical Scribe · Live, syncing every 5s"
            : "AI Clinical Scribe · Live"
          : "AI Clinical Scribe"}
        <div
          className="absolute -bottom-2 right-6 w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "8px solid var(--ink)",
          }}
        />
      </div>

      {state === "recording" && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-full animate-ping opacity-20"
          style={{ background: "var(--critical)" }}
        />
      )}

      <Button
        onClick={isCapturing ? stopRecording : startRecording}
        disabled={isProcessing && !isCapturing}
        size="icon"
        className={cn(
          "relative h-14 w-14 rounded-full overflow-hidden transition-all duration-300",
          isCapturing ? "scale-105" : !isProcessing && "hover:scale-105"
        )}
        style={{
          background: isCapturing
            ? "var(--critical)"
            : isProcessing
              ? "var(--ink-2)"
              : "var(--brand-ink)",
          border: "4px solid var(--paper)",
          cursor: isProcessing && !isCapturing ? "wait" : "pointer",
          opacity: isProcessing && !isCapturing ? 0.9 : 1,
          color: "white",
        }}
      >
        {isCapturing ? (
          <div className="flex flex-col items-center gap-0.5">
            <Square className="h-4 w-4 fill-current" />
            <span className="text-[9px] font-bold tracking-wider">
              {formatTime(recordingTime)}
            </span>
          </div>
        ) : isProcessing ? (
          <div className="flex flex-col items-center gap-0.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[9px] font-bold px-1">WAIT</span>
          </div>
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
