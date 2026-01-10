import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/_lib/auth/get-current-user";
import { parseVisitNoteFromTranscript } from "@/app/_lib/ai/parse-visit";

/**
 * Parse transcript into structured visit note
 * POST /api/ai/parse-visit
 * Body: { transcript: string, prompt?: string, patientContext?: { allergies?, meds?, pmh? } }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth
    await requireUser(["doctor", "nurse"]);

    const body = await request.json();
    const { transcript, prompt, patientContext, previousTranscripts } = body;

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid transcript" },
        { status: 400 }
      );
    }

    // Use the shared parsing function
    const parsedNote = await parseVisitNoteFromTranscript({
      transcript,
      prompt,
      patientContext,
      previousTranscripts,
    });

    // Add metadata
    parsedNote.transcript = transcript;
    parsedNote.aiGeneratedAt = new Date().toISOString();

    return NextResponse.json({
      parsed: parsedNote,
      warnings: [], // Could add warnings for missing fields
    });
  } catch (error) {
    console.error("Parse visit error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
