import { NextRequest, NextResponse } from "next/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { auth } from "@/app/_lib/auth/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    const role = (session?.user as Record<string, unknown> | undefined)?.role;
    if (!session?.user || (role !== "doctor" && role !== "nurse" && role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const overview = await getPatientOverview(id);

    if (!overview) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Error fetching patient:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
