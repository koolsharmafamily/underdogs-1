import { and, eq, isNull } from "drizzle-orm";
import { guests } from "../db/schema";
import type { Db } from "../db/types";
import { ANONYMOUS, type Actor } from "./actor";

/** Turns a verified session's guest id into an Actor. Deleted or unknown guests are anonymous. */
export async function resolveActor(db: Db, guestId: string): Promise<Actor> {
  const [row] = await db
    .select({ id: guests.id, role: guests.role, name: guests.name, phone: guests.phone })
    .from(guests)
    .where(and(eq(guests.id, guestId), isNull(guests.deletedAt)));
  if (!row) return ANONYMOUS;
  return { kind: "guest", guestId: row.id, role: row.role, name: row.name, phone: row.phone };
}
