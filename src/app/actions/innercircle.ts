"use server";
import { revalidatePath } from "next/cache";
import { endSession, getActor, startSession } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { requestOtp, verifyOtp } from "@/lib/domain/auth";
import { isDomainError } from "@/lib/domain/errors";
import {
  claimCoinAndSubmitRsvp,
  deleteMyData,
  issueDirectCoin,
  joinWaitlist,
  reviewCoinRsvp,
  reviewInviteRequest,
  submitInviteRequest,
} from "@/lib/domain/innercircle";

function formatErr(e: unknown): string {
  if (isDomainError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export async function sendOtpAction(phone: string): Promise<{ ok: true; phone: string; demoCode?: string } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const res = await requestOtp(db, await getActor(db), { phone });
    return { ok: true, phone: res.phone, demoCode: res.demoCode };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function verifyOtpAndSignInAction(input: {
  phone: string;
  code: string;
  name?: string;
}): Promise<{ ok: true; guestId: string } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const res = await verifyOtp(db, await getActor(db), input);
    await startSession(db, res.guestId);
    revalidatePath("/", "layout");
    return { ok: true, guestId: res.guestId };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function signOutAction(): Promise<void> {
  await endSession();
  revalidatePath("/", "layout");
}

export async function submitInviteRequestAction(input: {
  name: string;
  instagramHandle?: string;
  nights: string[];
  bringing?: string;
  note?: string;
  vouchCode?: string;
}): Promise<{ ok: true; requestId: string; status: string } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    const res = await submitInviteRequest(db, actor, input);
    revalidatePath("/innercircle");
    revalidatePath("/me");
    revalidatePath("/crew");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function claimCoinAction(input: {
  token: string;
  name: string;
  instagramHandle?: string;
  companionDetails?: string;
  note?: string;
}): Promise<
  | {
      ok: true;
      coinId: string;
      serial: number;
      engraving: string;
      rsvpStatus: string;
      notificationMessage: string;
    }
  | { ok: false; error: string }
> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    const res = await claimCoinAndSubmitRsvp(db, actor, input);
    revalidatePath(`/coin/${input.token}`);
    revalidatePath("/me");
    revalidatePath("/crew");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function reviewInviteRequestAction(input: {
  requestId: string;
  decision: "approved" | "waitlisted" | "declined";
  plusOnes?: number;
  crewNotes?: string;
}): Promise<{ ok: true; status: string; token?: string; serial?: number } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    const res = await reviewInviteRequest(db, actor, input);
    revalidatePath("/crew");
    revalidatePath("/me");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function reviewCoinRsvpAction(input: {
  coinId: string;
  decision: "confirmed" | "waitlisted" | "declined";
}): Promise<{ ok: true; rsvpStatus: string } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    const res = await reviewCoinRsvp(db, actor, input);
    revalidatePath("/crew");
    revalidatePath("/me");
    revalidatePath("/innercircle/the-gold-room");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function issueDirectCoinAction(input: {
  phone: string;
  name: string;
  instagramHandle?: string;
  plusOnes?: number;
}): Promise<{ ok: true; coinUrl: string; serial: number } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    const res = await issueDirectCoin(db, actor, input);
    revalidatePath("/crew");
    return { ok: true, coinUrl: res.coinUrl, serial: res.serial };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function joinWaitlistAction(
  eventSlug?: string,
): Promise<{ ok: true; waitlistId: string; status: string } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    const res = await joinWaitlist(db, actor, { eventSlug });
    revalidatePath("/me");
    revalidatePath("/crew");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}

export async function deleteMyDataAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const db = await getDb();
    const actor = await getActor(db);
    await deleteMyData(db, actor);
    await endSession();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatErr(e) };
  }
}
