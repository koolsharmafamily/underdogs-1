import { setTimeSourceForTests } from "@/lib/clock";
import { openReadyDb, type DbHandle } from "@/lib/db";

/** Sunday 27 Sep 2026, noon IST: the day the plan was approved. */
export const TODAY = new Date("2026-09-27T12:00:00+05:30");

/** A fresh in-memory database, migrated and seeded with the wall clock pinned to `at`. */
export async function freshDb(at: Date = TODAY): Promise<DbHandle> {
  pinClock(at);
  return openReadyDb("memory");
}

export function pinClock(at: Date): void {
  setTimeSourceForTests(() => at.getTime());
}
