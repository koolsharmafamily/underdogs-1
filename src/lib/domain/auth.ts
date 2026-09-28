/*
  Phone + OTP sign-in. Six digits, five minutes, five attempts. Only a keyed
  hash of the code is stored. In demo mode the code is returned to the caller
  so the UI can show it in a toast; outside demo mode it would go by SMS.
*/
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getSecret } from "../auth/secrets";
import { now } from "../clock";
import { hmacHex, numericCode, safeEqual } from "../crypto";
import { guests, otpChallenges } from "../db/schema";
import type { Db } from "../db/types";
import { isDemoMode } from "../env";
import { normalisePhone } from "../phone";
import type { Actor } from "./actor";
import { DomainError } from "./errors";

export const OTP_DIGITS = 6;
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;

const phoneInput = z.string().trim().min(1).max(32);

async function hashCode(db: Db, phone: string, code: string) {
  return hmacHex(await getSecret(db, "session"), `otp:${phone}:${code}`);
}

function parsePhone(raw: unknown): string {
  const phone = normalisePhone(phoneInput.parse(raw));
  if (!phone) throw new DomainError("invalid", "That doesn't look like an Indian mobile number.");
  return phone;
}

export type OtpRequested = { phone: string; expiresAt: Date; demoCode?: string };

export async function requestOtp(db: Db, _actor: Actor, input: { phone: string }): Promise<OtpRequested> {
  const phone = parsePhone(input.phone);
  const t = await now(db);

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), gt(otpChallenges.createdAt, new Date(t.getTime() - 3600_000))));
  if (recent >= OTP_MAX_PER_HOUR) throw new DomainError("locked", "Too many codes for this number. Try again in an hour.");

  const code = numericCode(OTP_DIGITS);
  const expiresAt = new Date(t.getTime() + OTP_TTL_MS);
  await db.transaction(async (tx) => {
    // Only the newest code works.
    await tx
      .update(otpChallenges)
      .set({ consumedAt: t })
      .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)));
    await tx.insert(otpChallenges).values({ phone, codeHash: await hashCode(tx, phone, code), expiresAt, createdAt: t });
  });

  return isDemoMode() ? { phone, expiresAt, demoCode: code } : { phone, expiresAt };
}

export type OtpVerified = { guestId: string; isNew: boolean };

export async function verifyOtp(
  db: Db,
  _actor: Actor,
  input: { phone: string; code: string; name?: string },
): Promise<OtpVerified> {
  const phone = parsePhone(input.phone);
  const code = z.string().trim().regex(/^\d{6}$/, "Six digits.").safeParse(input.code);
  if (!code.success) throw new DomainError("invalid", "The code is six digits.");
  const t = await now(db);

  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt)))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  if (!challenge || challenge.expiresAt <= t) throw new DomainError("expired", "That code has expired. Ask for a new one.");
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new DomainError("locked", "Too many tries. Ask for a new code.");

  if (!safeEqual(await hashCode(db, phone, code.data), challenge.codeHash)) {
    const [row] = await db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(and(eq(otpChallenges.id, challenge.id), lt(otpChallenges.attempts, OTP_MAX_ATTEMPTS)))
      .returning({ attempts: otpChallenges.attempts });
    const left = OTP_MAX_ATTEMPTS - (row?.attempts ?? OTP_MAX_ATTEMPTS);
    if (left <= 0) throw new DomainError("locked", "Too many tries. Ask for a new code.");
    throw new DomainError("invalid", `Not quite. ${left} ${left === 1 ? "try" : "tries"} left.`);
  }

  return db.transaction(async (tx) => {
    // Conditional update: a code can be spent once, even by two requests at the same moment.
    const [spent] = await tx
      .update(otpChallenges)
      .set({ consumedAt: t })
      .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    if (!spent) throw new DomainError("expired", "That code was already used. Ask for a new one.");

    const name = input.name?.trim().slice(0, 80) || null;
    const [existing] = await tx.select({ id: guests.id, name: guests.name }).from(guests).where(eq(guests.phone, phone));
    if (existing) {
      await tx
        .update(guests)
        .set({ phoneVerifiedAt: t, deletedAt: null, ...(name && !existing.name ? { name } : {}) })
        .where(eq(guests.id, existing.id));
      return { guestId: existing.id, isNew: false };
    }
    const [created] = await tx
      .insert(guests)
      .values({ phone, name, phoneVerifiedAt: t, createdAt: t })
      .returning({ id: guests.id });
    return { guestId: created.id, isNew: true };
  });
}
