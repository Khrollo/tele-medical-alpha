import { db } from "../index";
import { transcripts } from "../schema";
import { eq } from "drizzle-orm";

/**
 * Create a new transcript for a visit
 */
export async function createTranscript(params: {
  visitId: string;
  text: string;
  rawText?: string;
  status?: string;
}) {
  const result = await db
    .insert(transcripts)
    .values({
      visitId: params.visitId,
      text: params.text,
      rawText: params.rawText || params.text,
      status: params.status || "completed",
    })
    .returning();

  return result[0];
}

/**
 * Get all transcripts for a visit
 */
export async function getVisitTranscripts(visitId: string) {
  return await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.visitId, visitId))
    .orderBy(transcripts.createdAt);
}

