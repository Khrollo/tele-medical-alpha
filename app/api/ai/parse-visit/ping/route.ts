import { NextResponse } from "next/server";
import { requireUser } from "@/app/_lib/auth/get-current-user";
import { resolveActiveProvider } from "@/app/_lib/ai/parse-visit-incremental";

export async function GET() {
    try {
        await requireUser(["doctor", "nurse"]);
    } catch {
        return NextResponse.json(
            { ok: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    const provider = resolveActiveProvider();

    if (provider === "anthropic") {
        if (!process.env.ANTHROPIC_API_KEY) {
            return NextResponse.json(
                {
                    ok: false,
                    provider,
                    error: "ANTHROPIC_API_KEY is not configured",
                },
                { status: 503 }
            );
        }
        return NextResponse.json({ ok: true, provider });
    }

    if (!process.env.OPENROUTER_API_KEY) {
        return NextResponse.json(
            {
                ok: false,
                provider,
                error: "OPENROUTER_API_KEY is not configured",
            },
            { status: 503 }
        );
    }
    return NextResponse.json({ ok: true, provider });
}
