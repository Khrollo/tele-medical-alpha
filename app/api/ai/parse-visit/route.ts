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
    
    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      // Check for specific error types
      if (error.message.includes("REPLICATE_API_KEY")) {
        console.error("Missing REPLICATE_API_KEY environment variable in production!");
      }
      if (error.message.includes("Replicate API error")) {
        console.error("Replicate API call failed");
      }
      if (error.message.includes("Failed to parse JSON")) {
        console.error("AI model returned invalid JSON");
      }
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        // Include more context in development
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.stack : String(error),
        }),
      },
      { status: 500 }
    );
  }
}
