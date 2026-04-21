import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/_lib/auth/get-current-user";
import { uploadFile } from "@/app/_lib/storage";
import { getAvatarsStorageBucket } from "@/app/_lib/storage/config";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload a patient profile image to Supabase Storage.
 * POST /api/upload/patient-avatar
 * Body: FormData with `avatar` (File) and optional `patientId`.
 * Response: `{ avatarUrl }` — a public URL suitable for `<img src>`.
 */
export async function POST(request: NextRequest) {
  try {
    await requireUser(["doctor", "nurse"]);

    const formData = await request.formData();
    const file = formData.get("avatar");
    const patientId = formData.get("patientId") as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No avatar file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds 5 MB limit" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is not configured" },
        { status: 500 }
      );
    }

    const targetPatientId = patientId || uuidv4();
    const bucket = getAvatarsStorageBucket();
    const ext = EXT_BY_TYPE[file.type];
    const path = `${targetPatientId}/${uuidv4()}-avatar.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(bucket, path, buffer, {
      contentType: file.type,
      upsert: false,
    });

    const avatarUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("Patient avatar upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
