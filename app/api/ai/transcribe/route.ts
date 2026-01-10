import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/_lib/auth/get-current-user";
import { transcribeAudio } from "@/app/_lib/ai/transcribe";

/**
 * Transcribe audio from Supabase Storage
 * POST /api/ai/transcribe
 * Body: { audioPath: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth
    await requireUser(["doctor", "nurse"]);

    const body = await request.json();
    const { audioPath } = body;

    if (!audioPath) {
      return NextResponse.json(
        { error: "audioPath is required" },
        { status: 400 }
      );
    }

    // Use the shared transcription function
    const result = await transcribeAudio(audioPath);

    return NextResponse.json({
      transcriptId: result.transcriptId,
      text: result.text,
      rawText: result.rawText,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Legacy code removed - transcription is now handled by app/_lib/ai/transcribe.ts
