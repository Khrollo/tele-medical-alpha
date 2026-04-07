"use client";

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface LiveSpeechSnapshot {
  finalTranscript: string;
  interimTranscript: string;
  fullTranscript: string;
  appendedFinalTranscript: string;
}

interface CreateLiveSpeechControllerOptions {
  lang?: string;
  restartOnEnd?: boolean;
  onStateChange?: (state: "idle" | "listening" | "stopped" | "unsupported") => void;
  onSnapshot: (snapshot: LiveSpeechSnapshot) => void;
  onError?: (message: string) => void;
}

export interface LiveSpeechController {
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isLiveSpeechSupported(): boolean {
  return !!getSpeechRecognitionCtor();
}

export function createLiveSpeechController(
  options: CreateLiveSpeechControllerOptions
): LiveSpeechController {
  const ctor = getSpeechRecognitionCtor();

  if (!ctor) {
    options.onStateChange?.("unsupported");
    return {
      isSupported: false,
      start: async () => {
        options.onError?.("Live speech recognition is not supported in this browser.");
      },
      stop: () => {
        options.onStateChange?.("stopped");
      },
      destroy: () => {
        options.onStateChange?.("stopped");
      },
    };
  }

  let recognition: SpeechRecognitionLike | null = null;
  let shouldRestart = false;
  let finalSegments: string[] = [];

  const emitSnapshot = (
    appendedFinalTranscript = "",
    interimTranscript = ""
  ) => {
    const finalTranscript = finalSegments.join(" ").trim();
    options.onSnapshot({
      finalTranscript,
      interimTranscript: interimTranscript.trim(),
      fullTranscript: [finalTranscript, interimTranscript.trim()].filter(Boolean).join(" ").trim(),
      appendedFinalTranscript: appendedFinalTranscript.trim(),
    });
  };

  const ensureRecognition = () => {
    if (recognition) {
      return recognition;
    }

    recognition = new ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.lang || "en-US";

    recognition.onstart = () => {
      options.onStateChange?.("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let appendedFinalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim();

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          finalSegments = [...finalSegments, transcript];
          appendedFinalTranscript = [appendedFinalTranscript, transcript].filter(Boolean).join(" ").trim();
        } else {
          interimTranscript = [interimTranscript, transcript].filter(Boolean).join(" ").trim();
        }
      }

      emitSnapshot(appendedFinalTranscript, interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const message = event.message || event.error || "Speech recognition failed.";
      if (event.error === "not-allowed") {
        shouldRestart = false;
      }
      options.onError?.(message);
    };

    recognition.onend = () => {
      options.onStateChange?.("stopped");
      if (shouldRestart) {
        try {
          recognition?.start();
        } catch {
          shouldRestart = false;
        }
      }
    };

    return recognition;
  };

  return {
    isSupported: true,
    start: async () => {
      const instance = ensureRecognition();
      shouldRestart = options.restartOnEnd ?? true;
      finalSegments = [];
      emitSnapshot();
      instance.start();
    },
    stop: () => {
      shouldRestart = false;
      recognition?.stop();
      options.onStateChange?.("stopped");
    },
    destroy: () => {
      shouldRestart = false;
      recognition?.abort();
      recognition = null;
      options.onStateChange?.("idle");
    },
  };
}
