/*
  The whole data model (without ticketing, payment gateways, or door check-in).
  Every time is a UTC timestamptz, with the event's IANA timezone stored beside it.
  Column names are snake_case in Postgres (drizzle `casing`), camelCase here.
*/
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = () => timestamp({ withTimezone: true, mode: "date" });
const createdAt = () => ts().notNull().defaultNow();

// ── Enums ────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["guest", "crew", "admin"]);
export const eventKindEnum = pgEnum("event_kind", ["public", "innercircle"]);
export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled", "hidden"]);
export const requestStatusEnum = pgEnum("request_status", [
  "submitted",
  "in_review",
  "approved",
  "waitlisted",
  "declined",
  "withdrawn",
]);
export const coinStatusEnum = pgEnum("coin_status", ["sent", "claimed", "expired", "revoked"]);
export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "not_submitted",
  "pending_review",
  "confirmed",
  "waitlisted",
  "declined",
]);
export const waitlistStatusEnum = pgEnum("waitlist_status", ["waiting", "offered", "claimed", "expired", "left"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant", "tool"]);
export const channelEnum = pgEnum("channel", ["whatsapp", "sms", "email"]);

// ── People ───────────────────────────────────────────────────────────────

export const guests = pgTable("guests", {
  id: uuid().primaryKey().defaultRandom(),
  phone: text().notNull().unique(), // E.164, e.g. +919000010001
  phoneVerifiedAt: ts(),
  name: text(),
  instagramHandle: text(),
  role: roleEnum().notNull().default("guest"),
  consent: jsonb().$type<{ messages?: boolean; terms?: boolean; at?: string }>(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
  deletedAt: ts(),
});

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid().primaryKey().defaultRandom(),
    phone: text().notNull(),
    codeHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: ts().notNull(),
    consumedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.phone, t.createdAt)],
);

// ── Nights ───────────────────────────────────────────────────────────────

export const venues = pgTable("venues", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  area: text(),
  city: text().notNull(),
  address: text(),
  mapsUrl: text(),
  isDemo: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    kind: eventKindEnum().notNull(),
    status: eventStatusEnum().notNull().default("draft"),
    title: text().notNull(),
    tagline: text(),
    description: text(),
    theme: text().notNull().default("vault"),
    soundTags: text().array().notNull().default(sql`'{}'::text[]`),
    lineup: text().array().notNull().default(sql`'{}'::text[]`),
    partners: text().array().notNull().default(sql`'{}'::text[]`), // text only, never logos
    dressCode: text(),
    doorPolicy: text(),
    minAge: integer(),
    capacity: integer().notNull().default(40),
    confirmedCount: integer().notNull().default(0),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    timezone: text().notNull().default("Asia/Kolkata"),
    timeTbc: boolean().notNull().default(false), // real past nights: only the date is known
    dropAt: ts(),
    dropFiredAt: ts(),
    venueId: uuid().references(() => venues.id),
    posterKey: text(), // a file under public/brand, e.g. "launch-post"
    sortmysceneUrl: text(),
    instagramUrl: text(),
    isDemo: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.kind, t.startsAt),
    check("events_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
    check("events_capacity_valid", sql`${t.confirmedCount} >= 0 and ${t.confirmedCount} <= ${t.capacity}`),
  ],
);

// ── The circle ───────────────────────────────────────────────────────────

export type RequestAnswers = {
  nights: string[];
  bringing?: string;
  note?: string;
};

export type CrewSummary = {
  summary: string;
  flags: string[];
  source: "model" | "rules";
};

export type CoinClaimDetails = {
  name: string;
  phone: string;
  instagramHandle?: string;
  companionDetails?: string;
  note?: string;
  submittedAt: string;
};

export const inviteRequests = pgTable(
  "invite_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    guestId: uuid()
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    eventId: uuid().references(() => events.id),
    season: text().notNull(),
    name: text().notNull(),
    instagramHandle: text(),
    answers: jsonb().$type<RequestAnswers>().notNull(),
    vouchCode: text(),
    status: requestStatusEnum().notNull().default("submitted"),
    reviewedBy: uuid().references(() => guests.id),
    reviewedAt: ts(),
    aiSummary: jsonb().$type<CrewSummary>(),
    crewNotes: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status, t.createdAt), index().on(t.guestId)],
);

export const coins = pgTable(
  "coins",
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenHash: text().notNull().unique(), // SHA-256 of the 32-byte link token; the token itself is never stored
    guestId: uuid().references(() => guests.id, { onDelete: "set null" }), // bound on first open
    intendedPhone: text(), // set for direct invites from a guest list
    requestId: uuid().references(() => inviteRequests.id, { onDelete: "set null" }),
    eventId: uuid().references(() => events.id),
    season: text().notNull(),
    serial: integer().notNull(),
    engraving: text().notNull(), // the name on the rim, e.g. "AARAV"
    plusOnes: integer().notNull().default(0),
    status: coinStatusEnum().notNull().default("sent"),
    rsvpStatus: rsvpStatusEnum().notNull().default("not_submitted"),
    claimDetails: jsonb().$type<CoinClaimDetails>(),
    rsvpReviewedBy: uuid().references(() => guests.id),
    rsvpReviewedAt: ts(),
    issuedBy: uuid().references(() => guests.id),
    expiresAt: ts().notNull(),
    claimedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex().on(t.season, t.serial),
    index().on(t.guestId),
    check("coins_plus_ones_non_negative", sql`${t.plusOnes} >= 0`),
  ],
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    guestId: uuid()
      .notNull()
      .references(() => guests.id, { onDelete: "cascade" }),
    qty: integer().notNull().default(1),
    status: waitlistStatusEnum().notNull().default("waiting"),
    offeredAt: ts(),
    offerExpiresAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.eventId, t.status, t.createdAt),
    uniqueIndex("waitlist_one_active_per_guest")
      .on(t.eventId, t.guestId)
      .where(sql`${t.status} in ('waiting', 'offered')`),
  ],
);

// ── Audit, chat, content, messages, settings ─────────────────────────────

export const statusLog = pgTable(
  "status_log",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    entity: text().notNull(), // "invite_request", "coin", "waitlist_entry", "event"
    entityId: text().notNull(),
    fromStatus: text(),
    toStatus: text().notNull(),
    actorId: uuid().references(() => guests.id, { onDelete: "set null" }),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entity, t.entityId)],
);

export const chatSessions = pgTable("chat_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  guestId: uuid().references(() => guests.id, { onDelete: "cascade" }),
  context: jsonb().$type<{ mode: "global" } | { mode: "event"; slug: string }>(),
  createdAt: createdAt(),
  lastActiveAt: ts().notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid()
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: chatRoleEnum().notNull(),
    content: text().notNull(),
    parts: jsonb().$type<unknown[]>(),
    mood: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.sessionId, t.createdAt)],
);

export const faqs = pgTable("faqs", {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(), // "dress-code", "age", "plus-ones", ...
  question: text().notNull(),
  answer: text().notNull(),
  eventId: uuid().references(() => events.id, { onDelete: "cascade" }),
  sort: integer().notNull().default(0),
  isDemo: boolean().notNull().default(false),
  updatedAt: ts().notNull().defaultNow(),
});

export const messagesOut = pgTable(
  "messages_out",
  {
    id: uuid().primaryKey().defaultRandom(),
    guestId: uuid().references(() => guests.id, { onDelete: "cascade" }),
    toPhone: text().notNull(),
    channel: channelEnum().notNull().default("whatsapp"),
    template: text().notNull(), // request_received, approved, rsvp_received, rsvp_confirmed, waitlist_offer, location_drop, declined
    body: text().notNull(),
    vars: jsonb().$type<Record<string, string>>(),
    eventId: uuid().references(() => events.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.guestId, t.createdAt)],
);

export const demoSettings = pgTable("demo_settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedAt: ts().notNull().defaultNow(),
});
