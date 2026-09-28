/*
  Signed session tokens (jose, HS256), carried in an httpOnly cookie.
  Issue and expiry times come from the demo clock, so time travel cannot
  log anyone out early.
*/
import { SignJWT, jwtVerify } from "jose";
import { now } from "../clock";
import type { Db } from "../db/types";
import { getSecret } from "./secrets";

export const SESSION_COOKIE = "ic_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 3600;
const ISSUER = "underdogs-innercircle";
const AUDIENCE = "innercircle-web";

async function key(db: Db) {
  return new TextEncoder().encode(await getSecret(db, "session"));
}

export async function signSession(db: Db, guestId: string): Promise<string> {
  const issuedAt = await now(db);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(guestId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(new Date(issuedAt.getTime() + SESSION_MAX_AGE_S * 1000))
    .sign(await key(db));
}

/** The guest id in a valid token, or null. Never throws on bad input. */
export async function verifySession(db: Db, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, await key(db), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: await now(db),
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
