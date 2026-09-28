/*
  Core Innercircle domain service (without ticketing, payment gateways, or door scanning).
  Every function takes (db, actor, input) and enforces authorisation and redaction in code.
*/
import { and, asc, desc, eq, gt, isNull, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { now } from "../clock";
import { randomToken, sha256Hex } from "../crypto";
import { IST, toLocal } from "../dates";
import * as t from "../db/schema";
import { SEASON } from "../db/seed";
import type { Db } from "../db/types";
import { isDemoMode } from "../env";
import { normalisePhone } from "../phone";
import { assertCan, assertSignedIn, can, system, type Actor } from "./actor";
import { DomainError } from "./errors";

export type InnercircleTeaser = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  theme: string;
  soundTags: string[];
  dressCode: string | null;
  doorPolicy: string | null;
  minAge: number | null;
  capacity: number;
  confirmedCount: number;
  startsAt: Date;
  endsAt: Date;
  dropAt: Date | null;
  timezone: string;
  hasDropped: boolean;
  isDemo: boolean;
};

const upcomingInnercircle = (at: Date) =>
  and(eq(t.events.kind, "innercircle"), eq(t.events.status, "published"), gt(t.events.endsAt, at));

/** The next Innercircle night, with no location fields at all. */
export async function getNextInnercircleTeaser(db: Db, _actor: Actor): Promise<InnercircleTeaser | null> {
  const at = await now(db);
  const [row] = await db
    .select({
      id: t.events.id,
      slug: t.events.slug,
      title: t.events.title,
      tagline: t.events.tagline,
      theme: t.events.theme,
      soundTags: t.events.soundTags,
      dressCode: t.events.dressCode,
      doorPolicy: t.events.doorPolicy,
      minAge: t.events.minAge,
      capacity: t.events.capacity,
      confirmedCount: t.events.confirmedCount,
      startsAt: t.events.startsAt,
      endsAt: t.events.endsAt,
      dropAt: t.events.dropAt,
      timezone: t.events.timezone,
      isDemo: t.events.isDemo,
    })
    .from(t.events)
    .where(upcomingInnercircle(at))
    .orderBy(asc(t.events.startsAt))
    .limit(1);
  if (!row) return null;
  return { ...row, hasDropped: row.dropAt !== null && row.dropAt <= at };
}

/**
 * The home page's world: the theme of the next Innercircle night, unless the
 * demo panel overrides it (demo mode only).
 */
export async function resolveSiteTheme(db: Db, actor: Actor, input: { override?: string | null }): Promise<string> {
  if (input.override && isDemoMode()) return input.override;
  const next = await getNextInnercircleTeaser(db, actor);
  return next?.theme ?? "vault";
}

export type PastNight = {
  slug: string;
  kind: "public" | "innercircle";
  title: string;
  tagline: string | null;
  theme: string;
  lineup: string[];
  partners: string[];
  dressCode: string | null;
  startsAt: Date;
  timezone: string;
  venueName: string | null;
  venueArea: string | null;
  posterKey: string | null;
  instagramUrl: string | null;
  isDemo: boolean;
};

/**
 * Nights that have ended, of both kinds, newest first, for the Been inside
 * chapter. Once a night is over its venue is no longer secret.
 */
export async function listPastNights(db: Db, _actor: Actor): Promise<PastNight[]> {
  const at = await now(db);
  return db
    .select({
      slug: t.events.slug,
      kind: t.events.kind,
      title: t.events.title,
      tagline: t.events.tagline,
      theme: t.events.theme,
      lineup: t.events.lineup,
      partners: t.events.partners,
      dressCode: t.events.dressCode,
      startsAt: t.events.startsAt,
      timezone: t.events.timezone,
      venueName: t.venues.name,
      venueArea: t.venues.area,
      posterKey: t.events.posterKey,
      instagramUrl: t.events.instagramUrl,
      isDemo: t.events.isDemo,
    })
    .from(t.events)
    .leftJoin(t.venues, eq(t.events.venueId, t.venues.id))
    .where(and(eq(t.events.status, "published"), lte(t.events.endsAt, at)))
    .orderBy(desc(t.events.startsAt));
}

export type InnercircleNightDetail = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  theme: string;
  soundTags: string[];
  lineup: string[];
  partners: string[];
  dressCode: string | null;
  doorPolicy: string | null;
  minAge: number | null;
  capacity: number;
  confirmedCount: number;
  startsAt: Date;
  endsAt: Date;
  dropAt: Date | null;
  timezone: string;
  hasDropped: boolean;
  isDemo: boolean;
  viewerRsvpStatus: t. CoinClaimDetails extends never ? never : "none" | "not_submitted" | "pending_review" | "confirmed" | "waitlisted" | "declined";
  /** Null unless the viewer is crew/admin, or holds a confirmed RSVP after dropAt. */
  venue: {
    name: string;
    area: string | null;
    city: string;
    address: string | null;
    mapsUrl: string | null;
  } | null;
};

/**
 * Status-aware and drop-redacted Innercircle night detail.
 * Venue fields are completely stripped unless the viewer is crew/admin OR
 * holds a confirmed coin RSVP for that night and current time >= dropAt.
 */
export async function getInnercircleNight(
  db: Db,
  actor: Actor,
  input: { slug: string },
): Promise<InnercircleNightDetail> {
  await tick(db, system("lazy_read"));
  const at = await now(db);
  const [row] = await db
    .select({
      id: t.events.id,
      slug: t.events.slug,
      title: t.events.title,
      tagline: t.events.tagline,
      description: t.events.description,
      theme: t.events.theme,
      soundTags: t.events.soundTags,
      lineup: t.events.lineup,
      partners: t.events.partners,
      dressCode: t.events.dressCode,
      doorPolicy: t.events.doorPolicy,
      minAge: t.events.minAge,
      capacity: t.events.capacity,
      confirmedCount: t.events.confirmedCount,
      startsAt: t.events.startsAt,
      endsAt: t.events.endsAt,
      dropAt: t.events.dropAt,
      timezone: t.events.timezone,
      isDemo: t.events.isDemo,
      venueName: t.venues.name,
      venueArea: t.venues.area,
      venueCity: t.venues.city,
      venueAddress: t.venues.address,
      venueMapsUrl: t.venues.mapsUrl,
    })
    .from(t.events)
    .leftJoin(t.venues, eq(t.events.venueId, t.venues.id))
    .where(and(eq(t.events.kind, "innercircle"), eq(t.events.status, "published"), eq(t.events.slug, input.slug)));

  if (!row) throw new DomainError("not_found", "No such Innercircle night.");

  const hasDropped = row.dropAt !== null && row.dropAt <= at;
  let viewerRsvpStatus: InnercircleNightDetail["viewerRsvpStatus"] = "none";

  if (actor.kind === "guest") {
    const [myCoin] = await db
      .select({ rsvpStatus: t.coins.rsvpStatus })
      .from(t.coins)
      .where(and(eq(t.coins.guestId, actor.guestId), eq(t.coins.eventId, row.id)))
      .orderBy(desc(t.coins.createdAt))
      .limit(1);
    if (myCoin) viewerRsvpStatus = myCoin.rsvpStatus;
  }

  const maySeeVenue =
    can(actor, "see_venues") ||
    row.endsAt <= at ||
    (hasDropped && viewerRsvpStatus === "confirmed");

  const { venueName, venueArea, venueCity, venueAddress, venueMapsUrl, ...rest } = row;
  return {
    ...rest,
    hasDropped,
    viewerRsvpStatus,
    venue:
      maySeeVenue && venueName
        ? {
            name: venueName,
            area: venueArea,
            city: venueCity ?? "Nagpur",
            address: venueAddress,
            mapsUrl: venueMapsUrl,
          }
        : null,
  };
}

// ── Helper: Engraving & Summary ──────────────────────────────────────────

export function cleanEngraving(name: string): string {
  const cleaned = name
    .replace(/\(demo\)/gi, "")
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return (cleaned || "MEMBER").slice(0, 14);
}

export function buildRuleSummary(input: {
  name: string;
  instagramHandle?: string | null;
  nights: string[];
  bringing?: string;
  note?: string;
  vouchCode?: string | null;
  hasDuplicate: boolean;
}): t.CrewSummary {
  const flags: string[] = [];
  if (input.hasDuplicate) flags.push("Possible duplicate");
  if (!input.instagramHandle?.trim()) flags.push("No Instagram handle");
  const words = [input.bringing ?? "", input.note ?? ""].join(" ").trim().split(/\s+/).filter(Boolean).length;
  if (words < 3) flags.push("Thin answers");
  if (input.vouchCode?.trim()) flags.push(`Vouch: ${input.vouchCode.trim()}`);
  if (input.nights.some((n) => /dolce|launch/i.test(n))) flags.push("Past Innercircle regular");

  const nightsText = input.nights.length ? input.nights.join(", ") : "no prior nights listed";
  const bringText = input.bringing?.trim() ? `Bringing: ${input.bringing.trim()}.` : "Coming solo.";
  return {
    summary: `${input.name} (${nightsText}). ${bringText}`,
    flags,
    source: "rules",
  };
}

// ── 1. Submit Invite Request ─────────────────────────────────────────────

const requestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  instagramHandle: z.string().trim().max(64).optional(),
  nights: z.array(z.string().trim().min(1)).min(1, "Pick at least one night or vibe you love."),
  bringing: z.string().trim().max(240).optional(),
  note: z.string().trim().max(400).optional(),
  vouchCode: z.string().trim().max(40).optional(),
  eventSlug: z.string().trim().optional(),
});

export async function submitInviteRequest(
  db: Db,
  actor: Actor,
  rawInput: z.input<typeof requestSchema>,
): Promise<{ requestId: string; status: string }> {
  assertSignedIn(actor);
  const input = requestSchema.parse(rawInput);
  const at = await now(db);

  const next = input.eventSlug
    ? (await db.select({ id: t.events.id, title: t.events.title }).from(t.events).where(eq(t.events.slug, input.eventSlug)))[0]
    : await getNextInnercircleTeaser(db, actor);

  const existing = await db
    .select({ id: t.inviteRequests.id, status: t.inviteRequests.status })
    .from(t.inviteRequests)
    .where(eq(t.inviteRequests.guestId, actor.guestId));

  const ig = input.instagramHandle?.replace(/^@/, "").trim() || null;
  let dupHandle = false;
  if (ig) {
    const [other] = await db
      .select({ id: t.inviteRequests.id })
      .from(t.inviteRequests)
      .where(and(eq(t.inviteRequests.instagramHandle, ig), ne(t.inviteRequests.guestId, actor.guestId)))
      .limit(1);
    dupHandle = Boolean(other);
  }

  const aiSummary = buildRuleSummary({
    name: input.name,
    instagramHandle: ig,
    nights: input.nights,
    bringing: input.bringing,
    note: input.note,
    vouchCode: input.vouchCode,
    hasDuplicate: existing.length > 0 || dupHandle,
  });

  return db.transaction(async (tx) => {
    await tx
      .update(t.guests)
      .set({ name: input.name, ...(ig ? { instagramHandle: ig } : {}) })
      .where(eq(t.guests.id, actor.guestId));

    const [created] = await tx
      .insert(t.inviteRequests)
      .values({
        guestId: actor.guestId,
        eventId: next?.id ?? null,
        season: SEASON,
        name: input.name,
        instagramHandle: ig,
        answers: {
          nights: input.nights,
          bringing: input.bringing || undefined,
          note: input.note || undefined,
        },
        vouchCode: input.vouchCode || null,
        status: "submitted",
        aiSummary,
        createdAt: at,
      })
      .returning({ id: t.inviteRequests.id, status: t.inviteRequests.status });

    await tx.insert(t.statusLog).values({
      entity: "invite_request",
      entityId: created.id,
      toStatus: "submitted",
      actorId: actor.guestId,
      reason: "Guest submitted request",
      createdAt: at,
    });

    await tx.insert(t.messagesOut).values({
      guestId: actor.guestId,
      toPhone: actor.phone,
      channel: "whatsapp",
      template: "request_received",
      body: `We have your request for ${next?.title ?? "Underdogs Innercircle"}, ${input.name}. The crew reads every one personally. 🖤`,
      vars: { requestId: created.id },
      eventId: next?.id ?? null,
      createdAt: at,
    });

    return { requestId: created.id, status: created.status };
  });
}

// ── 2. Crew Review of Invite Request ─────────────────────────────────────

async function nextSerial(tx: Db, season: string): Promise<number> {
  const [{ maxSerial }] = await tx
    .select({ maxSerial: sql<number>`coalesce(max(${t.coins.serial}), 0)::int` })
    .from(t.coins)
    .where(eq(t.coins.season, season));
  return maxSerial + 1;
}

export async function reviewInviteRequest(
  db: Db,
  actor: Actor,
  input: {
    requestId: string;
    decision: "approved" | "waitlisted" | "declined";
    plusOnes?: number;
    crewNotes?: string;
  },
): Promise<{ status: string; coinId?: string; token?: string; serial?: number }> {
  assertCan(actor, "review_requests");
  const at = await now(db);
  const reviewerId = actor.kind === "guest" ? actor.guestId : null;

  return db.transaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(t.inviteRequests)
      .where(eq(t.inviteRequests.id, input.requestId));
    if (!req) throw new DomainError("not_found", "Request not found.");

    const [guest] = await tx.select().from(t.guests).where(eq(t.guests.id, req.guestId));
    if (!guest) throw new DomainError("not_found", "Guest not found.");

    await tx
      .update(t.inviteRequests)
      .set({
        status: input.decision,
        reviewedBy: reviewerId,
        reviewedAt: at,
        crewNotes: input.crewNotes ?? req.crewNotes,
      })
      .where(eq(t.inviteRequests.id, req.id));

    await tx.insert(t.statusLog).values({
      entity: "invite_request",
      entityId: req.id,
      fromStatus: req.status,
      toStatus: input.decision,
      actorId: reviewerId,
      reason: input.crewNotes || `Crew ${input.decision}`,
      createdAt: at,
    });

    if (input.decision === "approved") {
      const token = randomToken(32);
      const tokenHash = sha256Hex(token);
      const serial = await nextSerial(tx, req.season);
      const engraving = cleanEngraving(req.name);
      const plusOnes = Math.max(0, Math.min(4, input.plusOnes ?? 1));
      const expiresAt = new Date(at.getTime() + 7 * 86_400_000);

      const [coin] = await tx
        .insert(t.coins)
        .values({
          tokenHash,
          guestId: req.guestId,
          intendedPhone: guest.phone,
          requestId: req.id,
          eventId: req.eventId,
          season: req.season,
          serial,
          engraving,
          plusOnes,
          status: "sent",
          rsvpStatus: "not_submitted",
          issuedBy: reviewerId,
          expiresAt,
          createdAt: at,
        })
        .returning({ id: t.coins.id });

      await tx.insert(t.statusLog).values({
        entity: "coin",
        entityId: coin.id,
        toStatus: "sent",
        actorId: reviewerId,
        reason: "Issued on request approval",
        createdAt: at,
      });

      const coinUrl = `/coin/${token}`;
      await tx.insert(t.messagesOut).values({
        guestId: guest.id,
        toPhone: guest.phone,
        channel: "whatsapp",
        template: "approved",
        body: `You're in. Your coin (Nº ${String(serial).padStart(4, "0")}) is ready. Open ${coinUrl} to claim your coin and submit your RSVP details. ✨`,
        vars: { coinUrl, token, serial: String(serial) },
        eventId: req.eventId,
        createdAt: at,
      });

      return { status: "approved", coinId: coin.id, token, serial };
    }

    if (input.decision === "waitlisted") {
      if (req.eventId) {
        await tx
          .insert(t.waitlistEntries)
          .values({
            eventId: req.eventId,
            guestId: guest.id,
            qty: 1,
            status: "waiting",
            createdAt: at,
          })
          .onConflictDoNothing();
      }
      await tx.insert(t.messagesOut).values({
        guestId: guest.id,
        toPhone: guest.phone,
        channel: "whatsapp",
        template: "waitlisted",
        body: "Full room. You're next in line, and we'll ping you the moment a spot opens.",
        eventId: req.eventId,
        createdAt: at,
      });
      return { status: "waitlisted" };
    }

    await tx.insert(t.messagesOut).values({
      guestId: guest.id,
      toPhone: guest.phone,
      channel: "whatsapp",
      template: "declined",
      body: "Not this time. The gate to the rage is always open: see our public nights.",
      eventId: req.eventId,
      createdAt: at,
    });
    return { status: "declined" };
  });
}

// ── 3. Direct Invite (Mint Coin Straight from Guest List) ────────────────

export async function issueDirectCoin(
  db: Db,
  actor: Actor,
  input: { phone: string; name: string; instagramHandle?: string; plusOnes?: number; eventId?: string },
): Promise<{ coinId: string; token: string; serial: number; coinUrl: string }> {
  assertCan(actor, "issue_coins");
  const phone = normalisePhone(input.phone);
  if (!phone) throw new DomainError("invalid", "Enter a valid Indian mobile number.");
  const name = input.name.trim();
  if (name.length < 2) throw new DomainError("invalid", "Enter the guest's name.");
  const at = await now(db);
  const issuerId = actor.kind === "guest" ? actor.guestId : null;
  const next = await getNextInnercircleTeaser(db, actor);
  const eventId = input.eventId ?? next?.id ?? null;

  return db.transaction(async (tx) => {
    let [guest] = await tx.select().from(t.guests).where(eq(t.guests.phone, phone));
    if (!guest) {
      [guest] = await tx
        .insert(t.guests)
        .values({
          phone,
          name,
          instagramHandle: input.instagramHandle?.replace(/^@/, "").trim() || null,
          role: "guest",
          isDemo: isDemoMode(),
          createdAt: at,
        })
        .returning();
    }

    const token = randomToken(32);
    const tokenHash = sha256Hex(token);
    const serial = await nextSerial(tx, SEASON);
    const engraving = cleanEngraving(name);
    const plusOnes = Math.max(0, Math.min(4, input.plusOnes ?? 1));
    const expiresAt = new Date(at.getTime() + 7 * 86_400_000);

    const [coin] = await tx
      .insert(t.coins)
      .values({
        tokenHash,
        guestId: guest.id,
        intendedPhone: phone,
        eventId,
        season: SEASON,
        serial,
        engraving,
        plusOnes,
        status: "sent",
        rsvpStatus: "not_submitted",
        issuedBy: issuerId,
        expiresAt,
        createdAt: at,
      })
      .returning({ id: t.coins.id });

    const coinUrl = `/coin/${token}`;
    await tx.insert(t.messagesOut).values({
      guestId: guest.id,
      toPhone: phone,
      channel: "whatsapp",
      template: "approved",
      body: `Personal invite from the crew: your coin (Nº ${String(serial).padStart(4, "0")}) is waiting at ${coinUrl} ✨`,
      vars: { coinUrl, token, serial: String(serial) },
      eventId,
      createdAt: at,
    });

    return { coinId: coin.id, token, serial, coinUrl };
  });
}

// ── 4. Coin Lookup & Exclusive Claim + RSVP Submission ───────────────────

export type CoinView = {
  id: string;
  season: string;
  serial: number;
  serialFormatted: string;
  engraving: string;
  plusOnes: number;
  status: "sent" | "claimed" | "expired" | "revoked";
  rsvpStatus: "not_submitted" | "pending_review" | "confirmed" | "waitlisted" | "declined";
  claimDetails: t.CoinClaimDetails | null;
  expiresAt: Date;
  claimedAt: Date | null;
  intendedPhoneHint: string | null;
  isBoundToViewer: boolean;
  isBoundToOther: boolean;
  event: InnercircleTeaser | null;
};

export async function getCoinByToken(db: Db, actor: Actor, input: { token: string }): Promise<CoinView> {
  const tokenHash = sha256Hex(input.token.trim());
  const [coin] = await db.select().from(t.coins).where(eq(t.coins.tokenHash, tokenHash));
  if (!coin) throw new DomainError("not_found", "No coin matches this invite link.");

  const next = await getNextInnercircleTeaser(db, actor);
  const viewerId = actor.kind === "guest" ? actor.guestId : null;
  // A coin is only locked to a phone once it has been claimed (or if it is already claimed by someone else).
  const isClaimed = coin.status === "claimed";
  const isBoundToViewer = Boolean(viewerId && coin.guestId === viewerId);
  const isBoundToOther = Boolean(isClaimed && coin.guestId && coin.guestId !== viewerId);

  const hint = coin.intendedPhone ? `${coin.intendedPhone.slice(0, 6)}••••${coin.intendedPhone.slice(-2)}` : null;

  return {
    id: coin.id,
    season: coin.season,
    serial: coin.serial,
    serialFormatted: `Nº ${String(coin.serial).padStart(4, "0")}`,
    engraving: coin.engraving,
    plusOnes: coin.plusOnes,
    status: coin.status,
    rsvpStatus: coin.rsvpStatus,
    claimDetails: isBoundToViewer || can(actor, "review_requests") ? (coin.claimDetails ?? null) : null,
    expiresAt: coin.expiresAt,
    claimedAt: coin.claimedAt,
    intendedPhoneHint: hint,
    isBoundToViewer,
    isBoundToOther,
    event: next,
  };
}

const claimSchema = z.object({
  token: z.string().trim().min(10),
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  instagramHandle: z.string().trim().max(64).optional(),
  companionDetails: z.string().trim().max(200).optional(),
  note: z.string().trim().max(400).optional(),
});

/**
 * Claims the coin, binds it to the signed-in guest's verified phone, engraves
 * their name on the rim, and submits their RSVP details for Innercircle review.
 */
export async function claimCoinAndSubmitRsvp(
  db: Db,
  actor: Actor,
  rawInput: z.input<typeof claimSchema>,
): Promise<{
  coinId: string;
  serial: number;
  engraving: string;
  rsvpStatus: "pending_review" | "confirmed";
  notificationMessage: string;
}> {
  assertSignedIn(actor);
  const input = claimSchema.parse(rawInput);
  const at = await now(db);
  const tokenHash = sha256Hex(input.token);

  return db.transaction(async (tx) => {
    const [coin] = await tx.select().from(t.coins).where(eq(t.coins.tokenHash, tokenHash));
    if (!coin) throw new DomainError("not_found", "No coin matches this link.");
    if (coin.status === "revoked") throw new DomainError("forbidden", "This coin has been revoked.");
    if (coin.expiresAt <= at && coin.status === "sent") {
      await tx.update(t.coins).set({ status: "expired" }).where(eq(t.coins.id, coin.id));
      throw new DomainError("expired", "This coin invite has expired.");
    }

    if (coin.status === "claimed" && coin.guestId && coin.guestId !== actor.guestId) {
      throw new DomainError("forbidden", "This coin has already been claimed by another phone number.");
    }
    if (coin.intendedPhone && coin.intendedPhone !== actor.phone) {
      throw new DomainError("forbidden", "This personal coin link was issued for a different phone number.");
    }

    const engraving = cleanEngraving(input.name);
    const ig = input.instagramHandle?.replace(/^@/, "").trim() || undefined;
    const claimDetails: t.CoinClaimDetails = {
      name: input.name,
      phone: actor.phone,
      instagramHandle: ig,
      companionDetails: input.companionDetails || undefined,
      note: input.note || undefined,
      submittedAt: at.toISOString(),
    };

    const nextRsvpStatus = coin.rsvpStatus === "confirmed" ? "confirmed" : "pending_review";

    await tx
      .update(t.coins)
      .set({
        guestId: actor.guestId,
        engraving,
        status: "claimed",
        claimedAt: coin.claimedAt ?? at,
        rsvpStatus: nextRsvpStatus,
        claimDetails,
      })
      .where(eq(t.coins.id, coin.id));

    await tx
      .update(t.guests)
      .set({ name: input.name, ...(ig ? { instagramHandle: ig } : {}) })
      .where(eq(t.guests.id, actor.guestId));

    await tx.insert(t.statusLog).values({
      entity: "coin",
      entityId: coin.id,
      fromStatus: coin.status,
      toStatus: "claimed",
      actorId: actor.guestId,
      reason: "Coin claimed and RSVP details submitted",
      createdAt: at,
    });

    const notificationMessage =
      "Your coin is minted and your details are with the Innercircle. The Innercircle crew will get back to you personally regarding your RSVP confirmation.";

    await tx.insert(t.messagesOut).values({
      guestId: actor.guestId,
      toPhone: actor.phone,
      channel: "whatsapp",
      template: "rsvp_received",
      body: `Coin Nº ${String(coin.serial).padStart(4, "0")} minted for ${engraving}. We've received your RSVP details — the Innercircle crew will get back to you personally regarding your RSVP confirmation. 🖤`,
      vars: { serial: String(coin.serial), engraving },
      eventId: coin.eventId,
      createdAt: at,
    });

    return {
      coinId: coin.id,
      serial: coin.serial,
      engraving,
      rsvpStatus: nextRsvpStatus,
      notificationMessage,
    };
  });
}

// ── 5. Crew RSVP Confirmation & Waitlist Promotion ───────────────────────

export async function reviewCoinRsvp(
  db: Db,
  actor: Actor,
  input: { coinId: string; decision: "confirmed" | "waitlisted" | "declined" },
): Promise<{ rsvpStatus: string }> {
  assertCan(actor, "review_requests");
  const at = await now(db);
  const reviewerId = actor.kind === "guest" ? actor.guestId : null;

  return db.transaction(async (tx) => {
    const [coin] = await tx.select().from(t.coins).where(eq(t.coins.id, input.coinId));
    if (!coin || !coin.guestId) throw new DomainError("not_found", "Claimed coin not found.");
    const [guest] = await tx.select().from(t.guests).where(eq(t.guests.id, coin.guestId));
    if (!guest) throw new DomainError("not_found", "Guest not found.");

    if (input.decision === "confirmed") {
      if (coin.eventId && coin.rsvpStatus !== "confirmed") {
        const [updatedEvent] = await tx
          .update(t.events)
          .set({ confirmedCount: sql`${t.events.confirmedCount} + 1` })
          .where(and(eq(t.events.id, coin.eventId), sql`${t.events.confirmedCount} + 1 <= ${t.events.capacity}`))
          .returning({ id: t.events.id, title: t.events.title, slug: t.events.slug, dropAt: t.events.dropAt });

        if (!updatedEvent) {
          throw new DomainError("conflict", "The room is at full capacity. Waitlist this RSVP instead.");
        }
      }

      await tx
        .update(t.coins)
        .set({ rsvpStatus: "confirmed", rsvpReviewedBy: reviewerId, rsvpReviewedAt: at })
        .where(eq(t.coins.id, coin.id));

      await tx.insert(t.statusLog).values({
        entity: "coin_rsvp",
        entityId: coin.id,
        fromStatus: coin.rsvpStatus,
        toStatus: "confirmed",
        actorId: reviewerId,
        reason: "Crew confirmed RSVP",
        createdAt: at,
      });

      await tx.insert(t.messagesOut).values({
        guestId: guest.id,
        toPhone: guest.phone,
        channel: "whatsapp",
        template: "rsvp_confirmed",
        body: `Your Innercircle RSVP is confirmed (Coin Nº ${String(coin.serial).padStart(4, "0")}). The exact venue address drops 72 hours before doors. ✨`,
        vars: { eventSlug: "the-gold-room" },
        eventId: coin.eventId,
        createdAt: at,
      });

      return { rsvpStatus: "confirmed" };
    }

    await tx
      .update(t.coins)
      .set({ rsvpStatus: input.decision, rsvpReviewedBy: reviewerId, rsvpReviewedAt: at })
      .where(eq(t.coins.id, coin.id));

    if (input.decision === "waitlisted" && coin.eventId) {
      await tx
        .insert(t.waitlistEntries)
        .values({ eventId: coin.eventId, guestId: guest.id, qty: 1, status: "waiting", createdAt: at })
        .onConflictDoNothing();
    }

    await tx.insert(t.messagesOut).values({
      guestId: guest.id,
      toPhone: guest.phone,
      channel: "whatsapp",
      template: input.decision === "waitlisted" ? "waitlisted" : "declined",
      body:
        input.decision === "waitlisted"
          ? "The room is currently full. You're next on the Innercircle waitlist and we'll ping you if a spot opens."
          : "We couldn't confirm a spot for this night. We'll keep your coin on file for the next circle.",
      eventId: coin.eventId,
      createdAt: at,
    });

    return { rsvpStatus: input.decision };
  });
}

/**
 * Cancels a confirmed RSVP and offers the freed spot to the oldest waiting
 * guest on the waitlist (30 min window on the day of the night, 12h before).
 */
export async function cancelRsvpAndPromoteWaitlist(
  db: Db,
  actor: Actor,
  input: { coinId?: string },
): Promise<{ cancelledCoinId: string; offeredToGuestName: string | null }> {
  const at = await now(db);

  return db.transaction(async (tx) => {
    let coin: typeof t.coins.$inferSelect | undefined;
    if (input.coinId) {
      [coin] = await tx.select().from(t.coins).where(eq(t.coins.id, input.coinId));
    } else {
      if (!isDemoMode() && !can(actor, "review_requests")) {
        throw new DomainError("forbidden", "Not allowed.");
      }
      [coin] = await tx
        .select()
        .from(t.coins)
        .where(eq(t.coins.rsvpStatus, "confirmed"))
        .orderBy(asc(t.coins.serial))
        .limit(1);
    }

    if (!coin || coin.rsvpStatus !== "confirmed") {
      throw new DomainError("not_found", "No confirmed RSVP found to cancel.");
    }

    if (actor.kind === "guest" && actor.guestId !== coin.guestId && !can(actor, "review_requests") && !isDemoMode()) {
      throw new DomainError("forbidden", "You can only cancel your own RSVP.");
    }

    await tx.update(t.coins).set({ rsvpStatus: "declined" }).where(eq(t.coins.id, coin.id));

    if (coin.eventId) {
      await tx
        .update(t.events)
        .set({ confirmedCount: sql`greatest(0, ${t.events.confirmedCount} - 1)` })
        .where(eq(t.events.id, coin.eventId));
    }

    let offeredToGuestName: string | null = null;
    if (coin.eventId) {
      const [event] = await tx.select().from(t.events).where(eq(t.events.id, coin.eventId));
      const [nextWaiting] = await tx
        .select()
        .from(t.waitlistEntries)
        .where(and(eq(t.waitlistEntries.eventId, coin.eventId), eq(t.waitlistEntries.status, "waiting")))
        .orderBy(asc(t.waitlistEntries.createdAt))
        .limit(1);

      if (nextWaiting && event) {
        const nowLocal = toLocal(at, IST);
        const startLocal = toLocal(event.startsAt, IST);
        const sameDay =
          nowLocal.year === startLocal.year &&
          nowLocal.month === startLocal.month &&
          nowLocal.day === startLocal.day;
        const windowMs = sameDay ? 30 * 60_000 : 12 * 3600_000;
        const offerExpiresAt = new Date(at.getTime() + windowMs);

        await tx
          .update(t.waitlistEntries)
          .set({ status: "offered", offeredAt: at, offerExpiresAt })
          .where(eq(t.waitlistEntries.id, nextWaiting.id));

        const [waitGuest] = await tx.select().from(t.guests).where(eq(t.guests.id, nextWaiting.guestId));
        if (waitGuest) {
          offeredToGuestName = waitGuest.name;
          const token = randomToken(32);
          const serial = await nextSerial(tx, SEASON);
          await tx.insert(t.coins).values({
            tokenHash: sha256Hex(token),
            guestId: waitGuest.id,
            intendedPhone: waitGuest.phone,
            eventId: event.id,
            season: SEASON,
            serial,
            engraving: cleanEngraving(waitGuest.name ?? "MEMBER"),
            plusOnes: 0,
            status: "sent",
            rsvpStatus: "not_submitted",
            expiresAt: offerExpiresAt,
            createdAt: at,
          });

          const coinUrl = `/coin/${token}`;
          await tx.insert(t.messagesOut).values({
            guestId: waitGuest.id,
            toPhone: waitGuest.phone,
            channel: "whatsapp",
            template: "waitlist_offer",
            body: `A spot just opened in ${event.title}. Claim your coin at ${coinUrl} within ${sameDay ? "30 minutes" : "12 hours"} before it passes on. ✨`,
            vars: { coinUrl, token, expiresAt: offerExpiresAt.toISOString() },
            eventId: event.id,
            createdAt: at,
          });
        }
      }
    }

    return { cancelledCoinId: coin.id, offeredToGuestName };
  });
}

// ── 6. Join Waitlist Directly (Goldie Tool / Page Action) ────────────────

export async function joinWaitlist(
  db: Db,
  actor: Actor,
  input: { eventSlug?: string },
): Promise<{ waitlistId: string; status: string }> {
  assertSignedIn(actor);
  const at = await now(db);
  const next = input.eventSlug
    ? (await db.select({ id: t.events.id, title: t.events.title }).from(t.events).where(eq(t.events.slug, input.eventSlug)))[0]
    : await getNextInnercircleTeaser(db, actor);
  if (!next) throw new DomainError("not_found", "No upcoming Innercircle night found.");

  const [existing] = await db
    .select()
    .from(t.waitlistEntries)
    .where(and(eq(t.waitlistEntries.eventId, next.id), eq(t.waitlistEntries.guestId, actor.guestId)))
    .limit(1);
  if (existing && (existing.status === "waiting" || existing.status === "offered")) {
    return { waitlistId: existing.id, status: existing.status };
  }

  const [entry] = await db
    .insert(t.waitlistEntries)
    .values({
      eventId: next.id,
      guestId: actor.guestId,
      qty: 1,
      status: "waiting",
      createdAt: at,
    })
    .returning({ id: t.waitlistEntries.id, status: t.waitlistEntries.status });

  return { waitlistId: entry.id, status: entry.status };
}

// ── 7. Tick: Location Drops, Waitlist Expiry & 30-Day Chat Purge ─────────

export async function tick(db: Db, _actor: Actor): Promise<{ dropsFired: number; offersExpired: number }> {
  const at = await now(db);
  let dropsFired = 0;
  let offersExpired = 0;

  await db.transaction(async (tx) => {
    // 1. Fire location drops for published Innercircle events whose dropAt has arrived
    const dueEvents = await tx
      .select({
        id: t.events.id,
        slug: t.events.slug,
        title: t.events.title,
        venueName: t.venues.name,
        venueArea: t.venues.area,
        venueAddress: t.venues.address,
        venueMapsUrl: t.venues.mapsUrl,
      })
      .from(t.events)
      .leftJoin(t.venues, eq(t.events.venueId, t.venues.id))
      .where(
        and(
          eq(t.events.kind, "innercircle"),
          eq(t.events.status, "published"),
          isNull(t.events.dropFiredAt),
          lte(t.events.dropAt, at),
        ),
      );

    for (const ev of dueEvents) {
      await tx.update(t.events).set({ dropFiredAt: at }).where(eq(t.events.id, ev.id));
      dropsFired++;

      const confirmedHolders = await tx
        .select({
          guestId: t.guests.id,
          phone: t.guests.phone,
          name: t.guests.name,
        })
        .from(t.coins)
        .innerJoin(t.guests, eq(t.coins.guestId, t.guests.id))
        .where(and(eq(t.coins.eventId, ev.id), eq(t.coins.rsvpStatus, "confirmed")));

      for (const holder of confirmedHolders) {
        await tx.insert(t.messagesOut).values({
          guestId: holder.guestId,
          toPhone: holder.phone,
          channel: "whatsapp",
          template: "location_drop",
          body: `The drop for ${ev.title}: ${ev.venueName ?? "Secret Venue"}, ${ev.venueAddress ?? ev.venueArea ?? "Nagpur"}. Maps: ${ev.venueMapsUrl ?? ""} 📍`,
          vars: {
            eventSlug: ev.slug,
            venueName: ev.venueName ?? "",
            venueAddress: ev.venueAddress ?? "",
            mapsUrl: ev.venueMapsUrl ?? "",
          },
          eventId: ev.id,
          createdAt: at,
        });
      }
    }

    // 2. Expire lapsed waitlist offers
    const lapsed = await tx
      .update(t.waitlistEntries)
      .set({ status: "expired" })
      .where(and(eq(t.waitlistEntries.status, "offered"), lte(t.waitlistEntries.offerExpiresAt, at)))
      .returning({ id: t.waitlistEntries.id });
    offersExpired = lapsed.length;

    // 3. Purge chat sessions older than 30 days
    const cutoff = new Date(at.getTime() - 30 * 86_400_000);
    await tx.delete(t.chatSessions).where(lte(t.chatSessions.lastActiveAt, cutoff));
  });

  return { dropsFired, offersExpired };
}

// ── 8. My Status (/me & Goldie `my_status`) & DPDP Delete ────────────────

export async function getMyStatus(db: Db, actor: Actor) {
  assertSignedIn(actor);
  await tick(db, system("lazy_read"));

  const [requests, myCoins, waitlists, messages] = await Promise.all([
    db
      .select()
      .from(t.inviteRequests)
      .where(eq(t.inviteRequests.guestId, actor.guestId))
      .orderBy(desc(t.inviteRequests.createdAt)),
    db
      .select()
      .from(t.coins)
      .where(eq(t.coins.guestId, actor.guestId))
      .orderBy(desc(t.coins.createdAt)),
    db
      .select()
      .from(t.waitlistEntries)
      .where(eq(t.waitlistEntries.guestId, actor.guestId))
      .orderBy(desc(t.waitlistEntries.createdAt)),
    db
      .select()
      .from(t.messagesOut)
      .where(eq(t.messagesOut.guestId, actor.guestId))
      .orderBy(desc(t.messagesOut.createdAt))
      .limit(15),
  ]);

  const nextTeaser = await getNextInnercircleTeaser(db, actor);
  const nextNight = nextTeaser ? await getInnercircleNight(db, actor, { slug: nextTeaser.slug }) : null;

  return {
    actor,
    requests,
    coins: myCoins.map((c) => ({
      ...c,
      serialFormatted: `Nº ${String(c.serial).padStart(4, "0")}`,
    })),
    waitlists,
    messages,
    nextNight,
  };
}

export async function deleteMyData(db: Db, actor: Actor): Promise<void> {
  assertSignedIn(actor);
  const at = await now(db);
  await db.transaction(async (tx) => {
    await tx.delete(t.chatSessions).where(eq(t.chatSessions.guestId, actor.guestId));
    await tx.delete(t.messagesOut).where(eq(t.messagesOut.guestId, actor.guestId));
    await tx.delete(t.waitlistEntries).where(eq(t.waitlistEntries.guestId, actor.guestId));
    await tx.delete(t.inviteRequests).where(eq(t.inviteRequests.guestId, actor.guestId));
    await tx
      .update(t.coins)
      .set({ guestId: null, claimDetails: null, status: "revoked", rsvpStatus: "declined" })
      .where(eq(t.coins.guestId, actor.guestId));
    await tx
      .update(t.guests)
      .set({
        name: null,
        instagramHandle: null,
        consent: null,
        deletedAt: at,
        phone: `deleted:${actor.guestId}`,
      })
      .where(eq(t.guests.id, actor.guestId));
  });
}

// ── 9. FAQ & Crew Dashboard Queries ──────────────────────────────────────

export async function listFaqs(db: Db, _actor: Actor) {
  return db.select().from(t.faqs).orderBy(asc(t.faqs.sort));
}

export async function getCrewDashboard(db: Db, actor: Actor) {
  assertCan(actor, "review_requests");
  await tick(db, system("crew_read"));

  const [requests, allCoins, waitlists, outbox, nights, faqs] = await Promise.all([
    db.select().from(t.inviteRequests).orderBy(desc(t.inviteRequests.createdAt)),
    db
      .select({
        id: t.coins.id,
        serial: t.coins.serial,
        engraving: t.coins.engraving,
        plusOnes: t.coins.plusOnes,
        status: t.coins.status,
        rsvpStatus: t.coins.rsvpStatus,
        claimDetails: t.coins.claimDetails,
        intendedPhone: t.coins.intendedPhone,
        claimedAt: t.coins.claimedAt,
        createdAt: t.coins.createdAt,
        guestName: t.guests.name,
        guestPhone: t.guests.phone,
      })
      .from(t.coins)
      .leftJoin(t.guests, eq(t.coins.guestId, t.guests.id))
      .orderBy(desc(t.coins.serial)),
    db
      .select({
        id: t.waitlistEntries.id,
        status: t.waitlistEntries.status,
        offeredAt: t.waitlistEntries.offeredAt,
        offerExpiresAt: t.waitlistEntries.offerExpiresAt,
        createdAt: t.waitlistEntries.createdAt,
        guestName: t.guests.name,
        guestPhone: t.guests.phone,
      })
      .from(t.waitlistEntries)
      .innerJoin(t.guests, eq(t.waitlistEntries.guestId, t.guests.id))
      .orderBy(asc(t.waitlistEntries.createdAt)),
    db.select().from(t.messagesOut).orderBy(desc(t.messagesOut.createdAt)).limit(40),
    db.select().from(t.events).orderBy(desc(t.events.startsAt)),
    db.select().from(t.faqs).orderBy(asc(t.faqs.sort)),
  ]);

  return { requests, coins: allCoins, waitlists, outbox, nights, faqs };
}
