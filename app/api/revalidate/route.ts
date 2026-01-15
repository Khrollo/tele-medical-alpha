import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "@/app/_lib/supabase/server";

/**
 * POST /api/revalidate
 * Revalidate cache tags (requires authenticated doctor/nurse)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow doctors and nurses
    if (session.role !== "doctor" && session.role !== "nurse") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { tags } = body;

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: "tags must be an array" },
        { status: 400 }
      );
    }

    // Revalidate each tag
    for (const tag of tags) {
      if (typeof tag === "string") {
        revalidateTag(tag, "max");
      }
    }

    return NextResponse.json({
      success: true,
      revalidated: tags.length,
    });
  } catch (error) {
    console.error("Error revalidating cache:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
