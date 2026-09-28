import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { runGoldieTurn } from "@/lib/goldie";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      sessionId?: string | null;
      context?: { mode: "global" } | { mode: "event"; slug: string };
    };
    const db = await getDb();
    const actor = await getActor(db);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rateKey = actor.kind === "guest" ? `guest:${actor.guestId}` : `ip:${ip}`;

    const result = await runGoldieTurn(db, actor, {
      message: body.message ?? "",
      sessionId: body.sessionId,
      context: body.context ?? { mode: "global" },
      rateLimitKey: rateKey,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        sessionId: "",
        reply: "Something flickered on my end. Check the upcoming nights below or message the crew on WhatsApp. 🖤",
        mood: "sorry",
        mode: "offline",
        cards: [],
      },
      { status: 200 },
    );
  }
}
