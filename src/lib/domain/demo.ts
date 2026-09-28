/*
  Demo-only controls. Everything here refuses to run unless DEMO_MODE is on.
*/
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getClockOffsetMs, now, offsetToReach, setClockOffsetMs } from "../clock";
import * as t from "../db/schema";
import { seedDemoData } from "../db/seed";
import type { Db } from "../db/types";
import { isDemoMode } from "../env";
import { isThemeId, type ThemeId } from "@/themes";
import { system, type Actor } from "./actor";
import { DomainError } from "./errors";
import { tick } from "./innercircle";

export type TimeTravel = "plus_hour" | "to_drop" | "to_doors" | "reset";

/** The demo panel's world override: a theme id, or null to follow the next night. */
export function chooseThemeOverride(_db: Db, _actor: Actor, input: { theme: string | null }): ThemeId | null {
  assertDemo();
  if (input.theme === null) return null;
  if (!isThemeId(input.theme)) throw new DomainError("invalid", "No such world.");
  return input.theme;
}

function assertDemo() {
  if (!isDemoMode()) throw new DomainError("demo_only", "Demo controls are off.");
}

async function nextInnercircleNight(db: Db, at: Date) {
  const [row] = await db
    .select({ startsAt: t.events.startsAt, dropAt: t.events.dropAt })
    .from(t.events)
    .where(and(eq(t.events.kind, "innercircle"), eq(t.events.status, "published"), gt(t.events.endsAt, at)))
    .orderBy(asc(t.events.startsAt))
    .limit(1);
  return row ?? null;
}

/** Moves the demo clock and runs tick() so due location drops fire immediately. Returns the new "now". */
export async function travelTime(db: Db, _actor: Actor, input: { to: TimeTravel }): Promise<Date> {
  assertDemo();
  const current = await now(db);
  switch (input.to) {
    case "reset":
      await setClockOffsetMs(db, 0);
      break;
    case "plus_hour":
      await setClockOffsetMs(db, (await getClockOffsetMs(db)) + 3600_000);
      break;
    case "to_drop":
    case "to_doors": {
      const night = await nextInnercircleNight(db, current);
      if (!night) throw new DomainError("not_found", "No Innercircle night ahead.");
      const target = input.to === "to_drop" ? night.dropAt : night.startsAt;
      if (!target) throw new DomainError("not_found", "That night has no drop time.");
      // One second past the moment, so "at or after" checks are unambiguous.
      if (target > current) await setClockOffsetMs(db, offsetToReach(new Date(target.getTime() + 1000)));
      break;
    }
  }
  await tick(db, system("time_travel"));
  return now(db);
}

/** Wipes and re-seeds the demo database. */
export async function resetDemoDatabase(db: Db, _actor: Actor): Promise<void> {
  assertDemo();
  await db.transaction(async (tx) => {
    await tx.delete(t.chatMessages);
    await tx.delete(t.chatSessions);
    await tx.delete(t.messagesOut);
    await tx.delete(t.statusLog);
    await tx.delete(t.waitlistEntries);
    await tx.delete(t.coins);
    await tx.delete(t.inviteRequests);
    await tx.delete(t.faqs);
    await tx.delete(t.events);
    await tx.delete(t.venues);
    await tx.delete(t.otpChallenges);
    await tx.delete(t.guests);
    await tx.execute(sql`delete from demo_settings where key not like 'secret:%'`);
    await seedDemoData(tx, await now(tx));
  });
}
