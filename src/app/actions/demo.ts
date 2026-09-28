"use server";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { endSession, getActor, startSession } from "@/lib/auth/request";
import { now } from "@/lib/clock";
import { THEME_COOKIE } from "@/lib/cookies";
import { getDb } from "@/lib/db";
import * as t from "@/lib/db/schema";
import { DEMO_PHONES } from "@/lib/db/seed";
import { chooseThemeOverride, resetDemoDatabase, travelTime, type TimeTravel } from "@/lib/domain/demo";
import { cancelRsvpAndPromoteWaitlist, getNextInnercircleTeaser } from "@/lib/domain/innercircle";
import { isDemoMode } from "@/lib/env";

/** Demo panel: switch the world, or pass null to follow the next Innercircle night again. */
export async function setThemeOverride(theme: string | null): Promise<void> {
  const db = await getDb();
  const value = chooseThemeOverride(db, await getActor(db), { theme });
  const jar = await cookies();
  if (value) jar.set(THEME_COOKIE, value, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 7 * 86_400 });
  else jar.delete(THEME_COOKIE);
  revalidatePath("/", "layout");
}

export type DemoPersonaKey = "anonymous" | "aarav" | "meera" | "kabir" | "admin";

export async function switchDemoPersona(persona: DemoPersonaKey): Promise<void> {
  if (!isDemoMode()) throw new Error("Demo mode is off.");
  if (persona === "anonymous") {
    await endSession();
    revalidatePath("/", "layout");
    return;
  }
  const db = await getDb();
  const phone = DEMO_PHONES[persona];
  const [guest] = await db.select({ id: t.guests.id }).from(t.guests).where(eq(t.guests.phone, phone));
  if (!guest) throw new Error("Demo persona not found; try resetting demo data.");
  await startSession(db, guest.id);
  revalidatePath("/", "layout");
}

export async function timeTravelAction(to: TimeTravel): Promise<{ nowIso: string }> {
  const db = await getDb();
  const actor = await getActor(db);
  const nextNow = await travelTime(db, actor, { to });
  revalidatePath("/", "layout");
  return { nowIso: nextNow.toISOString() };
}

export async function simulateCancellationAction(): Promise<{ offeredToGuestName: string | null }> {
  const db = await getDb();
  const actor = await getActor(db);
  const res = await cancelRsvpAndPromoteWaitlist(db, actor, {});
  revalidatePath("/", "layout");
  return { offeredToGuestName: res.offeredToGuestName };
}

export async function resetDemoAction(): Promise<void> {
  const db = await getDb();
  const actor = await getActor(db);
  await resetDemoDatabase(db, actor);
  await endSession();
  const jar = await cookies();
  jar.delete(THEME_COOKIE);
  revalidatePath("/", "layout");
}

export async function getDemoStateAction() {
  const db = await getDb();
  const actor = await getActor(db);
  const currentNow = await now(db);
  const nextNight = await getNextInnercircleTeaser(db, actor);
  const outbox = await db
    .select({
      id: t.messagesOut.id,
      toPhone: t.messagesOut.toPhone,
      template: t.messagesOut.template,
      body: t.messagesOut.body,
      vars: t.messagesOut.vars,
      createdAt: t.messagesOut.createdAt,
    })
    .from(t.messagesOut)
    .orderBy(desc(t.messagesOut.createdAt))
    .limit(12);

  return {
    nowIso: currentNow.toISOString(),
    actor:
      actor.kind === "guest"
        ? { kind: "guest" as const, name: actor.name, phone: actor.phone, role: actor.role }
        : { kind: "anonymous" as const },
    nextNight: nextNight
      ? {
          title: nextNight.title,
          slug: nextNight.slug,
          hasDropped: nextNight.hasDropped,
          confirmedCount: nextNight.confirmedCount,
          capacity: nextNight.capacity,
        }
      : null,
    outbox: outbox.map((m) => ({
      ...m,
      createdAtIso: m.createdAt.toISOString(),
    })),
  };
}
