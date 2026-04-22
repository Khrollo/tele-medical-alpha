import { getSignedUrl } from "@/app/_lib/storage";
import { getAudioStorageBucket } from "@/app/_lib/storage/config";

interface ReplicateTranscriptSegment {
  text?: string;
}

/**
 * Transcribe audio from Supabase Storage
 * This is the core transcription logic that can be called directly from server code
 * without going through the HTTP API.
 */
export async function transcribeAudio(audioPath: string) {
  const replicateApiKey = process.env.REPLICATE_API_KEY;

  if (!replicateApiKey) {
    throw new Error("Missing REPLICATE_API_KEY environment variable");
  }

  // Get signed URL from Supabase Storage using service role key
  const bucket = getAudioStorageBucket();

  let audioUrl: string;
  try {
    const urlData = await getSignedUrl(bucket, audioPath, 3600);
    audioUrl = urlData.signedUrl;
    console.log("Using Supabase signed URL for transcription");
  } catch (error) {
    console.error("URL error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to create signed URL for audio"
    );
  }

  // Replicate's /v1/predictions endpoint expects the `version` field to be a
  // bare 64-char version hash, NOT "owner/name:hash". The previous value
  // "vaibhavs10/incredibly-fast-whisper:3ab86df..." is consistently rejected
  // with a 422 `invalid version` error — this was the root cause of the
  // transcription pipeline failing silently in the finalize route.
  //
  // We post to the model-scoped predictions endpoint instead of the global
  // one so we don't have to pin a specific version hash. That also lets
  // Replicate transparently route to the currently-recommended version of
  // `vaibhavs10/incredibly-fast-whisper` without a code change every time
  // the model gets retrained. If we ever need deterministic version pinning
  // we can switch back to `/v1/predictions` with `version: "<hash-only>"`.
  const MODEL_OWNER = "vaibhavs10";
  const MODEL_NAME = "incredibly-fast-whisper";

  const transcriptionInput = { audio: audioUrl };

  const predictionResponse = await fetch(
    `https://api.replicate.com/v1/models/${MODEL_OWNER}/${MODEL_NAME}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateApiKey}`,
        "Content-Type": "application/json",
        // Ask Replicate to block up to 60s for short clips. When it returns
        // with status=succeeded we skip the polling loop entirely, which
        // shaves multiple seconds off the critical path for sub-minute clips.
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: transcriptionInput,
      }),
    }
  );

  if (!predictionResponse.ok) {
    const errorData = await predictionResponse.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Replicate API error: ${predictionResponse.statusText}`
    );
  }

  const prediction = await predictionResponse.json();
  const predictionId = prediction.id as string;

  const extractTranscript = (output: unknown): string => {
    if (typeof output === "string") return output;
    if (output && typeof output === "object") {
      const o = output as { text?: string };
      if (typeof o.text === "string") return o.text;
    }
    if (Array.isArray(output)) {
      return output
        .map((seg: string | ReplicateTranscriptSegment) =>
          typeof seg === "string" ? seg : seg.text || ""
        )
        .join(" ");
    }
    return "";
  };

  // Fast-path: if `Prefer: wait` returned a terminal status in the initial
  // POST, there's nothing to poll for.
  if (prediction.status === "succeeded") {
    return {
      transcriptId: predictionId,
      text: extractTranscript(prediction.output),
      rawText: extractTranscript(prediction.output),
    };
  }
  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(
      `Transcription failed: ${prediction.error || "Unknown error"}`
    );
  }

  // Adaptive poll: tight 1s cadence for the first 10s (short clips finish
  // fast), then back off to 3s. Hard cap at ~5 minutes so we never hang
  // the finalize request indefinitely.
  const DEADLINE_MS = 5 * 60 * 1000;
  const startedAt = Date.now();
  let iteration = 0;

  while (Date.now() - startedAt < DEADLINE_MS) {
    const elapsed = Date.now() - startedAt;
    const delay = elapsed < 10_000 ? 1000 : 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    iteration += 1;

    const statusResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: { Authorization: `Token ${replicateApiKey}` },
      }
    );

    if (!statusResponse.ok) {
      // Transient 5xx shouldn't abort the whole pipeline. Let the loop retry
      // up to the deadline; only 4xx here would indicate a true failure,
      // which we'd still want to fail fast on.
      if (statusResponse.status >= 400 && statusResponse.status < 500) {
        throw new Error(
          `Replicate status error ${statusResponse.status}: ${statusResponse.statusText}`
        );
      }
      continue;
    }

    const status = await statusResponse.json();

    if (status.status === "succeeded") {
      return {
        transcriptId: predictionId,
        text: extractTranscript(status.output),
        rawText: extractTranscript(status.output),
      };
    }
    if (status.status === "failed" || status.status === "canceled") {
      throw new Error(
        `Transcription failed: ${status.error || "Unknown error"}`
      );
    }
    // intentional no-op — still running
    void iteration;
  }

  throw new Error("Transcription timed out");
}

