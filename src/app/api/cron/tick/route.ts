import { NextRequest, NextResponse } from "next/server";
import { getSecret } from "@/lib/auth/secrets";
import { safeEqual } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { system } from "@/lib/domain/actor";
import { tick } from "@/lib/domain/innercircle";

export async function POST(req: NextRequest) {
  const db = await getDb();
  const secret = await getSecret(db, "cron");
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await tick(db, system("cron_endpoint"));
  return NextResponse.json({ ok: true, ...result });
}
