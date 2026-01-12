import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getVisitById } from "@/app/_lib/db/drizzle/queries/visit";
import { uploadFile } from "@/app/_lib/storage";

export const runtime = "nodejs";

const CHUNKS_BUCKET = "telehealth_audio";

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
    const formData = await request.formData();

    const chunk = formData.get("chunk") as File;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string);
    const recordingSessionId = formData.get("recordingSessionId") as string;
    const mimeType = formData.get("mimeType") as string;

    if (!chunk || chunkIndex === undefined || !recordingSessionId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: chunk, chunkIndex, recordingSessionId",
        },
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

    // Store chunk in Supabase Storage
    // Path structure: chunks/{visitId}/{recordingSessionId}/chunk-000000
    const chunkFileName = `chunk-${chunkIndex.toString().padStart(6, "0")}`;
    const storagePath = `chunks/${visitId}/${recordingSessionId}/${chunkFileName}`;

    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload chunk to Supabase Storage
    await uploadFile(CHUNKS_BUCKET, storagePath, buffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: false, // Don't overwrite existing chunks
    });

    return NextResponse.json({
      success: true,
      chunkIndex,
      message: "Chunk uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload chunk",
      },
      { status: 500 }
    );
  }
}
