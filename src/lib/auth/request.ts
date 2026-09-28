/*
  Request-bound auth: reads and writes the session cookie and resolves the
  Actor for the current request. Cookie writes only work in server actions
  and route handlers.
*/
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Db } from "../db/types";
import { ANONYMOUS, type Actor } from "../domain/actor";
import { resolveActor } from "../domain/guests";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, signSession, verifySession } from "./session";

/** The Actor behind this request, resolved once per render. */
export const getActor = cache(async (db: Db): Promise<Actor> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return ANONYMOUS;
  const guestId = await verifySession(db, token);
  return guestId ? resolveActor(db, guestId) : ANONYMOUS;
});

export async function startSession(db: Db, guestId: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSession(db, guestId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
