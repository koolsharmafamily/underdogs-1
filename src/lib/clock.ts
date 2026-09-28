/*
  The only source of "now" in the app. In demo mode a stored offset shifts the
  clock (time travel), so every rule that reads the time moves together:
  holds, offers, the drop, QR windows, sessions.
*/
import { eq } from "drizzle-orm";
import { demoSettings } from "./db/schema";
import type { Db } from "./db/types";
import { isDemoMode } from "./env";

const OFFSET_KEY = "clock_offset_ms";

let source: () => number = () => Date.now();

/** Tests only: pin the underlying wall clock. Pass null to restore Date.now. */
export function setTimeSourceForTests(fn: (() => number) | null): void {
  source = fn ?? (() => Date.now());
}

/** Wall-clock time with no demo offset. Only for things that must not time-travel (rate limits). */
export function wallClock(): Date {
  return new Date(source());
}

export async function getClockOffsetMs(db: Db): Promise<number> {
  if (!isDemoMode()) return 0;
  const [row] = await db.select({ value: demoSettings.value }).from(demoSettings).where(eq(demoSettings.key, OFFSET_KEY));
  const value = Number(row?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** Now, with the demo offset applied in demo mode. */
export async function now(db: Db): Promise<Date> {
  return new Date(source() + (await getClockOffsetMs(db)));
}

/** Low-level write of the offset. Callers go through domain/demo.ts, which checks demo mode. */
export async function setClockOffsetMs(db: Db, offsetMs: number): Promise<void> {
  const value = Math.round(offsetMs);
  await db
    .insert(demoSettings)
    .values({ key: OFFSET_KEY, value, updatedAt: wallClock() })
    .onConflictDoUpdate({ target: demoSettings.key, set: { value, updatedAt: wallClock() } });
}

/** The offset needed so that now() reads `target`. */
export function offsetToReach(target: Date): number {
  return target.getTime() - source();
}
