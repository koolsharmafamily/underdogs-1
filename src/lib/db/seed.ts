/*
  Demo seed. Dates are relative to "today" in Asia/Kolkata at seed time.
  Everything invented is marked Demo; the only real content is the three past
  nights from section 2 of the brief. Runs once, on first start.
*/
import { eq, sql } from "drizzle-orm";
import { now as clockNow } from "../clock";
import { sha256Hex } from "../crypto";
import { IST, addDays, firstSaturdayAtLeast, fromLocal, toLocal, type LocalDate } from "../dates";
import { INSTAGRAM_UNDERDOGS, SORTMYSCENE_ORGANISER_URL } from "../site";
import { SEED_LOCK } from "./migrate";
import * as t from "./schema";
import type { Db } from "./types";

export const SEASON = "2026";
export const MEERA_DEMO_COIN_TOKEN = "demo-coin-token-meera-0001-underdogs-innercircle";

/** Demo phone numbers. Nothing is ever sent to them; see DEMO_NOTES.md. */
export const DEMO_PHONES = {
  aarav: "+919000010001",
  meera: "+919000010002",
  kabir: "+919000010003",
  admin: "+919000010005",
} as const;

const at = (date: LocalDate, hour: number, minute = 0) => fromLocal({ ...date, hour, minute }, IST);

/** The seeded calendar, computed from an instant. Exported for tests. */
export function seedCalendar(today: Date) {
  const local = toLocal(today, IST);
  const goldRoomDate = firstSaturdayAtLeast(local, 12);
  const goldRoomStart = at(goldRoomDate, 21);
  const saturdays = [addDays(goldRoomDate, 7), addDays(goldRoomDate, 14)];
  return {
    goldRoom: {
      startsAt: goldRoomStart,
      endsAt: at(addDays(goldRoomDate, 1), 3),
      dropAt: new Date(goldRoomStart.getTime() - 72 * 3600_000),
    },
    publicNights: saturdays.map((d) => ({ date: d, startsAt: at(d, 22), endsAt: at(addDays(d, 1), 3) })),
  };
}

export async function isSeeded(db: Db): Promise<boolean> {
  const [row] = await db.select({ key: t.demoSettings.key }).from(t.demoSettings).where(eq(t.demoSettings.key, "seeded_at"));
  return Boolean(row);
}

/** Seeds once. Safe to call from several instances at the same time. */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  if (await isSeeded(db)) return false;
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`select pg_advisory_xact_lock(${SEED_LOCK})`));
    if (await isSeeded(tx)) return false;
    await seedDemoData(tx, await clockNow(tx));
    return true;
  });
}

/** Inserts the demo data into empty tables. Call inside a transaction. */
export async function seedDemoData(db: Db, today: Date): Promise<void> {
  const cal = seedCalendar(today);

  // ── Venues ──
  const [demoVenue, tbaVenue, millo, ashirwad] = await db
    .insert(t.venues)
    .values([
      {
        name: "Venue (Demo)",
        area: "Civil Lines",
        city: "Nagpur",
        address: "Address (Demo), Civil Lines, Nagpur",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Civil+Lines%2C+Nagpur",
        isDemo: true,
      },
      { name: "Venue to be announced (Demo)", city: "Nagpur", isDemo: true },
      { name: "Millo", area: "Civil Lines", city: "Nagpur" },
      { name: "Ashirwad Banquets", city: "Nagpur" },
    ])
    .returning({ id: t.venues.id });

  // ── Nights ──
  const [goldRoom] = await db
    .insert(t.events)
    .values({
      slug: "the-gold-room",
      kind: "innercircle",
      status: "published",
      title: "The Gold Room (Demo)",
      tagline: "Black satin. Gold on gold. Invite only.",
      description:
        "A demo night for this walkthrough. The crew sets the real theme, sound and dress code.",
      theme: "vault",
      soundTags: ["House", "Afro", "Hip Hop"],
      dressCode: "All black, one gold thing.",
      doorPolicy: "Confirmed Innercircle coin-holders and their approved companions.",
      minAge: 21,
      capacity: 40,
      confirmedCount: 1,
      startsAt: cal.goldRoom.startsAt,
      endsAt: cal.goldRoom.endsAt,
      dropAt: cal.goldRoom.dropAt,
      venueId: demoVenue.id,
      isDemo: true,
    })
    .returning({ id: t.events.id });

  await db.insert(t.events).values(
    cal.publicNights.map((n) => ({
      slug: `underdogs-saturday-${n.date.year}-${String(n.date.month).padStart(2, "0")}-${String(n.date.day).padStart(2, "0")}`,
      kind: "public" as const,
      status: "published" as const,
      title: "Underdogs Saturday (Demo)",
      tagline: "Loud. Themed. Open to all.",
      description:
        "A demo public night for this walkthrough. Real Underdogs nights are listed on SortMyScene.",
      theme: "vault",
      soundTags: ["Bollywood", "Commercial", "Hip Hop"],
      dressCode: "Dress for the theme.",
      minAge: 21,
      capacity: 200,
      confirmedCount: 0,
      startsAt: n.startsAt,
      endsAt: n.endsAt,
      venueId: tbaVenue.id,
      sortmysceneUrl: SORTMYSCENE_ORGANISER_URL,
      instagramUrl: INSTAGRAM_UNDERDOGS,
      isDemo: true,
    })),
  );

  // The real past nights (brief section 2). Only their dates are known, so times are marked TBC.
  const pastDay = (year: number, month: number, day: number) => ({
    startsAt: at({ year, month, day }, 21),
    endsAt: at(addDays({ year, month, day }, 1), 3),
    timeTbc: true,
  });
  await db.insert(t.events).values([
    {
      slug: "launch-night-live-by-all-means",
      kind: "innercircle",
      status: "published",
      title: "Launch night × Live By All Means",
      tagline: "By invitation only.",
      theme: "vault",
      lineup: ["DJ Monish"],
      partners: ["Live By All Means"],
      ...pastDay(2026, 6, 6),
      venueId: millo.id,
      posterKey: "launch-post",
      instagramUrl:
        "https://www.instagram.com/underdogsinnercircle/p/DZDQifGCAhDfSrqeHXAJIgpbLMRmYKkEMTAge80/",
    },
    {
      slug: "la-dolce-vita-80s",
      kind: "innercircle",
      status: "published",
      title: "La Dolce Vita, 80s edition",
      tagline: "A Greek-island night. The location stayed hidden until three days before.",
      theme: "aegean",
      lineup: ["DJ Luna", "DJ Monish"],
      partners: ["F Salon by FTV"],
      dressCode: "80s, compulsory.",
      ...pastDay(2026, 9, 12),
      venueId: millo.id,
      instagramUrl:
        "https://www.instagram.com/underdogsinnercircle/p/DdEvauVQaeFvEkcxurwGET_ai3WtnL86AgzOIU0/",
    },
    {
      slug: "underdogs-wonderland-nye-2026",
      kind: "public",
      status: "published",
      title: "Underdogs Wonderland – NYE 2026",
      theme: "vault",
      soundTags: ["Bollywood", "Commercial", "Hip Hop", "Afro"],
      ...pastDay(2025, 12, 31),
      venueId: ashirwad.id,
      sortmysceneUrl: SORTMYSCENE_ORGANISER_URL,
      instagramUrl: INSTAGRAM_UNDERDOGS,
    },
  ]);

  // ── People ──
  const people = await db
    .insert(t.guests)
    .values([
      { phone: DEMO_PHONES.aarav, name: "Aarav (Demo)", instagramHandle: "aarav.demo", role: "guest", isDemo: true },
      { phone: DEMO_PHONES.meera, name: "Meera (Demo)", instagramHandle: "meera.demo", role: "guest", isDemo: true },
      { phone: DEMO_PHONES.kabir, name: "Kabir (Demo)", instagramHandle: "kabir.demo", role: "guest", isDemo: true },
      { phone: DEMO_PHONES.admin, name: "Admin (Demo)", role: "admin", isDemo: true },
    ])
    .returning({ id: t.guests.id, phone: t.guests.phone });
  const byPhone = (phone: string) => people.find((p) => p.phone === phone)!.id;
  const meera = byPhone(DEMO_PHONES.meera);
  const kabir = byPhone(DEMO_PHONES.kabir);
  const admin = byPhone(DEMO_PHONES.admin);
  await db
    .update(t.guests)
    .set({ phoneVerifiedAt: today })
    .where(sql`${t.guests.isDemo} = true`);

  // Meera: approved, coin Nº 0001 claimed and RSVP confirmed for the Gold Room.
  const [meeraRequest] = await db
    .insert(t.inviteRequests)
    .values({
      guestId: meera,
      eventId: goldRoom.id,
      season: SEASON,
      name: "Meera (Demo)",
      instagramHandle: "meera.demo",
      answers: { nights: ["La Dolce Vita, 80s edition", "Launch night × Live By All Means"], bringing: "Coming solo." },
      status: "approved",
      reviewedBy: admin,
      reviewedAt: today,
      aiSummary: {
        summary: "Regular from Launch night and La Dolce Vita. Coming solo.",
        flags: ["Past attendee"],
        source: "rules",
      },
    })
    .returning({ id: t.inviteRequests.id });

  const [meeraCoin] = await db
    .insert(t.coins)
    .values({
      tokenHash: sha256Hex(MEERA_DEMO_COIN_TOKEN),
      guestId: meera,
      requestId: meeraRequest.id,
      eventId: goldRoom.id,
      season: SEASON,
      serial: 1,
      engraving: "MEERA",
      plusOnes: 0,
      status: "claimed",
      rsvpStatus: "confirmed",
      claimDetails: {
        name: "Meera (Demo)",
        phone: DEMO_PHONES.meera,
        instagramHandle: "meera.demo",
        companionDetails: "Solo",
        note: "See you in the vault.",
        submittedAt: today.toISOString(),
      },
      rsvpReviewedBy: admin,
      rsvpReviewedAt: today,
      issuedBy: admin,
      expiresAt: new Date(today.getTime() + 7 * 86_400_000),
      claimedAt: today,
    })
    .returning({ id: t.coins.id });

  await db.insert(t.messagesOut).values({
    guestId: meera,
    toPhone: DEMO_PHONES.meera,
    channel: "whatsapp",
    template: "rsvp_confirmed",
    body: "You're confirmed for The Gold Room (Demo). The exact address drops 72 hours before doors. ✨",
    vars: { coinUrl: `/coin/${MEERA_DEMO_COIN_TOKEN}`, eventSlug: "the-gold-room" },
    eventId: goldRoom.id,
    createdAt: today,
  });

  // Kabir: waitlisted for the Gold Room.
  const [kabirRequest] = await db
    .insert(t.inviteRequests)
    .values({
      guestId: kabir,
      eventId: goldRoom.id,
      season: SEASON,
      name: "Kabir (Demo)",
      instagramHandle: "kabir.demo",
      answers: { nights: ["Underdogs Wonderland – NYE 2026"], bringing: "A friend from the Wonderland crowd." },
      status: "waitlisted",
      reviewedBy: admin,
      reviewedAt: today,
      aiSummary: {
        summary: "Attended Wonderland NYE. Requesting entry with a friend.",
        flags: [],
        source: "rules",
      },
    })
    .returning({ id: t.inviteRequests.id });

  const [kabirEntry] = await db
    .insert(t.waitlistEntries)
    .values({ eventId: goldRoom.id, guestId: kabir, qty: 1 })
    .returning({ id: t.waitlistEntries.id });

  await db.insert(t.statusLog).values([
    { entity: "invite_request", entityId: meeraRequest.id, fromStatus: "submitted", toStatus: "approved", actorId: admin, reason: "Seed" },
    { entity: "coin", entityId: meeraCoin.id, fromStatus: "sent", toStatus: "claimed", actorId: meera, reason: "Seed" },
    { entity: "coin_rsvp", entityId: meeraCoin.id, fromStatus: "pending_review", toStatus: "confirmed", actorId: admin, reason: "Seed" },
    { entity: "invite_request", entityId: kabirRequest.id, fromStatus: "submitted", toStatus: "waitlisted", actorId: admin, reason: "Seed" },
    { entity: "waitlist_entry", entityId: kabirEntry.id, toStatus: "waiting", actorId: kabir, reason: "Seed" },
  ]);

  // ── FAQ: demo defaults for the crew to confirm (no ticket/refund references) ──
  await db.insert(t.faqs).values(
    [
      ["dress-code", "What's the dress code?", "Set per night, and it's on every night's card. The crew means it."],
      ["age", "Is there an age limit?", "Set per night. The demo nights are 21+, to be checked against the venue's licence."],
      ["id", "How does entry work?", "Innercircle nights are strictly by personal invite and confirmed RSVP. The crew curates every room."],
      ["plus-ones", "Can I bring a friend?", "Only if your coin allows a plus-one. Share their details when claiming your coin so the crew can review your RSVP."],
      ["rsvp", "How do I confirm my spot?", "When you claim your coin and submit your details, the Innercircle crew reviews your RSVP and gets back to you personally."],
      ["location", "Where is it?", "The address drops 72 hours before doors, to confirmed Innercircle guests only. 🔒"],
      ["photos", "Can I take photos?", "Of yourself, always. Of other guests, only with their consent."],
    ].map(([key, question, answer], sort) => ({ key, question, answer, sort, isDemo: true })),
  );

  await db.insert(t.demoSettings).values([
    { key: "season", value: SEASON },
    { key: "seeded_at", value: today.toISOString() },
  ]);
}
