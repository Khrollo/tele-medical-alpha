"use server";

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/app/_lib/auth/get-current-user";
import { db } from "@/app/_lib/db/drizzle";
import { notes } from "@/app/_lib/db/drizzle/schema";
import { parseVisitNote } from "@/app/_lib/visit-note/schema";

export async function POST(
  request: Request,
  context: { params: Promise<{ visitId: string }> }
) {
  try {
    await requireUser(["doctor"]);

    const { visitId } = await context.params;
    const body = (await request.json()) as {
      requestedFrom?: string;
      requestedFromUserId?: string;
      reason?: string;
    };

    if (!body.requestedFrom?.trim() || !body.requestedFromUserId?.trim()) {
      return NextResponse.json(
        { ok: false, error: "A co-sign provider must be selected." },
        { status: 400 }
      );
    }

    const existingNote = await db
      .select({ id: notes.id, note: notes.note })
      .from(notes)
      .where(eq(notes.visitId, visitId))
      .orderBy(desc(notes.createdAt))
      .limit(1);

    if (!existingNote[0]?.note) {
      return NextResponse.json(
        { ok: false, error: "Visit note not found." },
        { status: 404 }
      );
    }

    const parsedNote = parseVisitNote(existingNote[0].note);
    const updatedNote = {
      ...parsedNote,
      coSign: {
        ...parsedNote.coSign,
        requested: true,
        requestedFrom: body.requestedFrom.trim(),
        requestedFromUserId: body.requestedFromUserId.trim(),
        reason: body.reason?.trim() || parsedNote.coSign.reason,
        status: "pending",
        requestedAt: new Date().toISOString(),
      },
    };

    await db
      .update(notes)
      .set({
        note: updatedNote as unknown,
        content: JSON.stringify(updatedNote),
      })
      .where(eq(notes.id, existingNote[0].id));

    return NextResponse.json({
      ok: true,
      coSign: updatedNote.coSign,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send request.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
