/*
  Nights. Public Underdogs nights anyone may see in full.
*/
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { now } from "../clock";
import { events, venues } from "../db/schema";
import type { Db } from "../db/types";
import type { Actor } from "./actor";
import { DomainError } from "./errors";

export type PublicNight = {
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  theme: string;
  soundTags: string[];
  lineup: string[];
  partners: string[];
  dressCode: string | null;
  minAge: number | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  timeTbc: boolean;
  isPast: boolean;
  venue: { name: string; area: string | null; city: string; address: string | null; mapsUrl: string | null } | null;
  sortmysceneUrl: string | null;
  instagramUrl: string | null;
  isDemo: boolean;
};

const publicNightColumns = {
  slug: events.slug,
  title: events.title,
  tagline: events.tagline,
  description: events.description,
  theme: events.theme,
  soundTags: events.soundTags,
  lineup: events.lineup,
  partners: events.partners,
  dressCode: events.dressCode,
  minAge: events.minAge,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  timezone: events.timezone,
  timeTbc: events.timeTbc,
  sortmysceneUrl: events.sortmysceneUrl,
  instagramUrl: events.instagramUrl,
  isDemo: events.isDemo,
  venueName: venues.name,
  venueArea: venues.area,
  venueCity: venues.city,
  venueAddress: venues.address,
  venueMapsUrl: venues.mapsUrl,
};

function selectPublicNights(db: Db) {
  return db.select(publicNightColumns).from(events).leftJoin(venues, eq(events.venueId, venues.id));
}
type Row = Awaited<ReturnType<typeof selectPublicNights>>[number];

function toPublicNight(row: Row, at: Date): PublicNight {
  const { venueName, venueArea, venueCity, venueAddress, venueMapsUrl, ...rest } = row;
  return {
    ...rest,
    isPast: rest.endsAt <= at,
    venue: venueName
      ? { name: venueName, area: venueArea, city: venueCity ?? "Nagpur", address: venueAddress, mapsUrl: venueMapsUrl }
      : null,
  };
}

const isPublicListed = and(eq(events.kind, "public"), eq(events.status, "published"));

export async function listPublicNights(
  db: Db,
  _actor: Actor,
): Promise<{ upcoming: PublicNight[]; past: PublicNight[] }> {
  const at = await now(db);
  const [upcoming, past] = await Promise.all([
    selectPublicNights(db).where(and(isPublicListed, gt(events.endsAt, at))).orderBy(asc(events.startsAt)),
    selectPublicNights(db).where(and(isPublicListed, lte(events.endsAt, at))).orderBy(desc(events.startsAt)),
  ]);
  return { upcoming: upcoming.map((r) => toPublicNight(r, at)), past: past.map((r) => toPublicNight(r, at)) };
}

export async function getPublicNight(db: Db, _actor: Actor, input: { slug: string }): Promise<PublicNight> {
  const at = await now(db);
  const [row] = await selectPublicNights(db).where(and(isPublicListed, eq(events.slug, input.slug)));
  if (!row) throw new DomainError("not_found", "No such night.");
  return toPublicNight(row, at);
}
