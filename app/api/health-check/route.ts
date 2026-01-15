import { NextResponse } from "next/server";

/**
 * GET /api/health-check
 * Simple health check endpoint for network status detection
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
