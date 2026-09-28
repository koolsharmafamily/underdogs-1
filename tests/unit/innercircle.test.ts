import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setClockOffsetMs, setTimeSourceForTests } from "@/lib/clock";
import type { DbHandle } from "@/lib/db";
import * as t from "@/lib/db/schema";
import { DEMO_PHONES } from "@/lib/db/seed";
import { ANONYMOUS } from "@/lib/domain/actor";
import { travelTime } from "@/lib/domain/demo";
import { resolveActor } from "@/lib/domain/guests";
import {
  cancelRsvpAndPromoteWaitlist,
  claimCoinAndSubmitRsvp,
  getCoinByToken,
  getInnercircleNight,
  getNextInnercircleTeaser,
  listPastNights,
   resolveSiteTheme,
  reviewCoinRsvp,
  reviewInviteRequest,
  submitInviteRequest,
} from "@/lib/domain/innercircle";
import { freshDb } from "./helpers";

let h: DbHandle;
beforeAll(async () => {
  h = await freshDb();
});
afterAll(async () => {
  setTimeSourceForTests(null);
  await h.close();
});
afterEach(async () => {
  delete process.env.DEMO_MODE;
  await setClockOffsetMs(h.db, 0);
});

async function actorForPhone(phone: string) {
  const [g] = await h.db.select().from(t.guests).where(eq(t.guests.phone, phone));
  return resolveActor(h.db, g.id);
}

describe("Innercircle teaser & redaction", () => {
  it("is the Gold Room, with no location fields at all", async () => {
    const teaser = await getNextInnercircleTeaser(h.db, ANONYMOUS);
    expect(teaser?.title).toBe("The Gold Room (Demo)");
    expect(teaser?.hasDropped).toBe(false);
    const json = JSON.stringify(teaser);
    for (const secret of ["venue", "Venue (Demo)", "Address", "maps", "Civil Lines"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("redacts the venue on the night page before drop_at even for a confirmed guest", async () => {
    const meera = await actorForPhone(DEMO_PHONES.meera);
    const beforeDrop = await getInnercircleNight(h.db, meera, { slug: "the-gold-room" });
    expect(beforeDrop.venue).toBeNull();
    expect(JSON.stringify(beforeDrop)).not.toContain("Address (Demo)");
  });

  it("reveals the venue after drop_at ONLY to confirmed coin-holders and crew, never anonymous", async () => {
    await travelTime(h.db, ANONYMOUS, { to: "to_drop" });
    const anonView = await getInnercircleNight(h.db, ANONYMOUS, { slug: "the-gold-room" });
    expect(anonView.hasDropped).toBe(true);
    expect(anonView.venue).toBeNull();

    const meera = await actorForPhone(DEMO_PHONES.meera);
    const meeraView = await getInnercircleNight(h.db, meera, { slug: "the-gold-room" });
    expect(meeraView.venue).toMatchObject({
      name: "Venue (Demo)",
      area: "Civil Lines",
      address: "Address (Demo), Civil Lines, Nagpur",
    });
  });
});

describe("Invite Request -> Coin Mint -> Exclusive RSVP Review -> Location Drop -> Waitlist", () => {
  it("runs Aarav's full journey from request to coin claim, RSVP review notification, crew confirmation, and location drop", async () => {
    const aarav = await actorForPhone(DEMO_PHONES.aarav);
    const kabir = await actorForPhone(DEMO_PHONES.kabir);
    const admin = await actorForPhone(DEMO_PHONES.admin);

    // 1. Aarav submits an invite request
    const req = await submitInviteRequest(h.db, aarav, {
      name: "Aarav (Demo)",
      instagramHandle: "@aarav.demo",
      nights: ["La Dolce Vita, 80s edition"],
      bringing: "Coming solo or with one close friend.",
      vouchCode: "GOLD-MEERA",
    });
    expect(req.status).toBe("submitted");

    // 2. Crew approves Aarav's request and issues a personal coin
    const approved = await reviewInviteRequest(h.db, admin, {
      requestId: req.requestId,
      decision: "approved",
      plusOnes: 1,
    });
    expect(approved.status).toBe("approved");
    expect(approved.token).toBeTruthy();
    expect(approved.serial).toBe(2);

    // 3. Kabir cannot claim Aarav's personal coin (intendedPhone mismatch)
    await expect(
      claimCoinAndSubmitRsvp(h.db, kabir, {
        token: approved.token!,
        name: "Kabir (Demo)",
        instagramHandle: "kabir.demo",
      }),
    ).rejects.toThrow(/different phone number/);

    // 4. Aarav claims his coin and submits his RSVP details -> receives exclusive review notification
    const claimed = await claimCoinAndSubmitRsvp(h.db, aarav, {
      token: approved.token!,
      name: "Aarav (Demo)",
      instagramHandle: "aarav.demo",
      companionDetails: "Bringing 1 guest",
      note: "Excited for the Gold Room!",
    });
    expect(claimed.engraving).toBe("AARAV");
    expect(claimed.rsvpStatus).toBe("pending_review");
    expect(claimed.notificationMessage).toContain("get back to you personally regarding your RSVP");

    const coinView = await getCoinByToken(h.db, aarav, { token: approved.token! });
    expect(coinView.status).toBe("claimed");
    expect(coinView.rsvpStatus).toBe("pending_review");

    // 5. Before Crew confirms Aarav's RSVP, even after drop_at, Aarav cannot see the secret venue
    await travelTime(h.db, ANONYMOUS, { to: "to_drop" });
    const pendingDropView = await getInnercircleNight(h.db, aarav, { slug: "the-gold-room" });
    expect(pendingDropView.venue).toBeNull();

    // 6. Crew confirms Aarav's RSVP -> Aarav now unlocks the Location Drop!
    const rsvpConfirmed = await reviewCoinRsvp(h.db, admin, {
      coinId: claimed.coinId,
      decision: "confirmed",
    });
    expect(rsvpConfirmed.rsvpStatus).toBe("confirmed");

    const confirmedDropView = await getInnercircleNight(h.db, aarav, { slug: "the-gold-room" });
    expect(confirmedDropView.venue?.name).toBe("Venue (Demo)");
    expect(confirmedDropView.venue?.mapsUrl).toContain("google.com/maps");

    // 7. Cancelling an RSVP promotes Kabir from the waitlist with a timed coin offer
    const cancelRes = await cancelRsvpAndPromoteWaitlist(h.db, admin, { coinId: claimed.coinId });
    expect(cancelRes.offeredToGuestName).toBe("Kabir (Demo)");
  });
});

describe("site theme & been inside", () => {
  it("follows the next Innercircle night and honours demo override only in demo mode", async () => {
    expect(await resolveSiteTheme(h.db, ANONYMOUS, {})).toBe("vault");
    expect(await resolveSiteTheme(h.db, ANONYMOUS, { override: "aegean" })).toBe("aegean");
    process.env.DEMO_MODE = "false";
    expect(await resolveSiteTheme(h.db, ANONYMOUS, { override: "aegean" })).toBe("vault");
  });

  it("lists the three real past nights, newest first", async () => {
    const past = await listPastNights(h.db, ANONYMOUS);
    expect(past.map((n) => n.slug)).toEqual([
      "la-dolce-vita-80s",
      "launch-night-live-by-all-means",
      "underdogs-wonderland-nye-2026",
    ]);
    expect(past.every((n) => !n.isDemo)).toBe(true);
  });
});
