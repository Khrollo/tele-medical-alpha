import { NextRequest, NextResponse } from "next/server";

/**
 * @deprecated Twilio Room Recording webhook handler.
 * This endpoint is kept for backwards compatibility but no longer processes recordings.
 * Client-side recording is now used instead.
 */
export async function POST(request: NextRequest) {
  // Twilio recording webhooks are no longer processed
  // Client-side recording handles transcription directly
  return NextResponse.json({ received: true, message: "Webhook received but not processed (client-side recording in use)" });
}
