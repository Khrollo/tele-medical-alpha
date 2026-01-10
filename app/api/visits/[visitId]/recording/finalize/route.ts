import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getVisitById } from "@/app/_lib/db/drizzle/queries/visit";
import { readdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { uploadFile } from "@/app/_lib/storage";
import { saveTranscriptAction, updateVisitDraftAction } from "@/app/_actions/visits";
import type { VisitNote } from "@/app/_lib/visit-note/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ visitId: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session || (session.role !== "doctor" && session.role !== "nurse")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { visitId } = await params;
    const body = await request.json();
    const { recordingSessionId } = body;

    if (!recordingSessionId) {
      return NextResponse.json(
        { error: "recordingSessionId is required" },
        { status: 400 }
      );
    }

    // Verify visit and assignment
    const visit = await getVisitById(visitId);
    if (!visit || visit.clinicianId !== session.id) {
      return NextResponse.json(
        { error: "Not authorized for this visit" },
        { status: 403 }
      );
    }

    // Read and assemble chunks
    const chunksDir = join(
      process.cwd(),
      ".tmp",
      "recording-chunks",
      visitId,
      recordingSessionId
    );

    if (!existsSync(chunksDir)) {
      return NextResponse.json(
        { error: "Recording session not found" },
        { status: 404 }
      );
    }

    // Read all chunks in order
    const files = await readdir(chunksDir);
    const chunkFiles = files
      .filter((f) => f.startsWith("chunk-"))
      .sort()
      .map((f) => join(chunksDir, f));

    if (chunkFiles.length === 0) {
      return NextResponse.json(
        { error: "No chunks found for this session" },
        { status: 404 }
      );
    }

    // Assemble chunks into single buffer
    const chunks: Buffer[] = [];
    for (const chunkFile of chunkFiles) {
      const chunkData = await readFile(chunkFile);
      chunks.push(chunkData);
    }
    const finalBuffer = Buffer.concat(chunks);

    // Determine file extension from first chunk or default to webm
    const extension = "webm"; // Default, could be determined from mimeType if stored
    const fileName = `recording-${recordingSessionId}.${extension}`;
    const storagePath = `visits/${visit.patientId}/${visitId}/${fileName}`;

    // Upload to Supabase Storage
    const bucket = process.env.STORAGE_BUCKET || "visits";
    await uploadFile(bucket, storagePath, finalBuffer, {
      contentType: `audio/${extension}`,
      upsert: true,
    });

    // Clean up temporary chunks
    try {
      await rm(chunksDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up chunks directory:", error);
    }

    // Trigger transcription pipeline (call directly to avoid auth issues)
    let transcriptId: string | null = null;
    let transcriptText: string | null = null;
    let parsedNote: VisitNote | null = null;
    
    try {
      const { transcribeAudio } = await import("@/app/_lib/ai/transcribe");
      const transcriptData = await transcribeAudio(storagePath);
      transcriptId = transcriptData.transcriptId || null;
      transcriptText = transcriptData.text || null;

      // Save transcript to database
      if (transcriptText) {
        try {
          await saveTranscriptAction({
            visitId: visit.id,
            text: transcriptText,
            rawText: transcriptData.rawText || transcriptText,
          });
        } catch (error) {
          console.error("Error saving transcript:", error);
        }
      }

      // Trigger parsing if transcript is available (call directly to avoid auth issues)
      if (transcriptText) {
        try {
          const { parseVisitNoteFromTranscript } = await import("@/app/_lib/ai/parse-visit");
          parsedNote = await parseVisitNoteFromTranscript({
            transcript: transcriptText,
          });

          // Save parsed note to visit draft
          if (parsedNote) {
            try {
              await updateVisitDraftAction(visit.id, {
                notesJson: parsedNote,
              });
              console.log("Parsed note saved to visit draft");
            } catch (error) {
              console.error("Error saving parsed note to visit:", error);
            }
          }
        } catch (error) {
          console.error("Error parsing transcript:", error);
        }
      }
    } catch (error) {
      console.error("Transcription error:", error);
    }

    return NextResponse.json({
      success: true,
      transcriptId,
      transcript: transcriptText,
      parsedNote,
      audioPath: storagePath,
      message: "Recording finalized, transcription and parsing completed",
    });
  } catch (error) {
    console.error("Error finalizing recording:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to finalize recording",
      },
      { status: 500 }
    );
  }
}

