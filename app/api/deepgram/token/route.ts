import { NextResponse } from "next/server";
import { requireUser } from "@/app/_lib/auth/get-current-user";

/**
 * Mint a short-lived Deepgram project key the browser can use to open a
 * live-transcription WebSocket. The master API key is never exposed.
 *
 * Requires DEEPGRAM_API_KEY + DEEPGRAM_PROJECT_ID to be set. When either is
 * missing the route returns 503 so the orchestrator can fall back to Web
 * Speech / Whisper.
 */
export async function POST() {
    try {
        await requireUser(["doctor", "nurse"]);
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    const projectId = process.env.DEEPGRAM_PROJECT_ID;

    if (!apiKey || !projectId) {
        return NextResponse.json(
            { error: "Deepgram is not configured" },
            { status: 503 }
        );
    }

    try {
        const ttlSeconds = 60;
        const res = await fetch(
            `https://api.deepgram.com/v1/projects/${projectId}/keys`,
            {
                method: "POST",
                headers: {
                    Authorization: `Token ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    comment: "live-visit ephemeral",
                    scopes: ["usage:write"],
                    time_to_live_in_seconds: ttlSeconds,
                    tags: ["live-visit"],
                }),
            }
        );
        if (!res.ok) {
            const text = await res.text();
            return NextResponse.json(
                { error: `Deepgram token issue failed: ${res.status} ${text}` },
                { status: 502 }
            );
        }
        const json = (await res.json()) as { key: string; key_id: string };
        return NextResponse.json({
            key: json.key,
            keyId: json.key_id,
            expiresInSeconds: ttlSeconds,
        });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 }
        );
    }
}
