import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setTimeSourceForTests } from "@/lib/clock";
import type { DbHandle } from "@/lib/db";
import { migrate } from "@/lib/db/migrate";
import * as t from "@/lib/db/schema";
import { seedIfEmpty } from "@/lib/db/seed";
import { ANONYMOUS } from "@/lib/domain/actor";
import { isDomainError } from "@/lib/domain/errors";
import { getPublicNight, listPublicNights } from "@/lib/domain/events";
import { freshDb } from "./helpers";

let h: DbHandle;
beforeAll(async () => {
  h = await freshDb();
});
afterAll(async () => {
  setTimeSourceForTests(null);
  await h.close();
});

const count = async (table: PgTable) => (await h.db.select({ n: sql<number>`count(*)::int` }).from(table))[0].n;

describe("seed", () => {
  it("is idempotent: migrating and seeding again changes nothing", async () => {
    const before = await count(t.events);
    expect(await migrate(h.db)).toEqual([]);
    expect(await seedIfEmpty(h.db)).toBe(false);
    expect(await count(t.events)).toBe(before);
  });

  it("creates the Gold Room with guest-list capacity 40 and Meera confirmed", async () => {
    const [gold] = await h.db.select().from(t.events).where(eq(t.events.slug, "the-gold-room"));
    expect(gold).toMatchObject({
      kind: "innercircle",
      theme: "vault",
      isDemo: true,
      title: "The Gold Room (Demo)",
      capacity: 40,
      confirmedCount: 1,
    });
    expect(gold.startsAt.toISOString()).toBe("2026-10-10T15:30:00.000Z");
    expect(gold.dropAt?.toISOString()).toBe("2026-10-07T15:30:00.000Z");
  });

  it("labels every invented person Demo", async () => {
    const people = await h.db.select().from(t.guests);
    expect(people).toHaveLength(4);
    for (const p of people) expect(p.name).toMatch(/\(Demo\)$/);
    expect(people.find((p) => p.role === "admin")?.name).toBe("Admin (Demo)");
  });

  it("keeps the real past nights and labels every invented night Demo", async () => {
    const nights = await h.db.select().from(t.events);
    const real = ["launch-night-live-by-all-means", "la-dolce-vita-80s", "underdogs-wonderland-nye-2026"];
    for (const n of nights) {
      if (real.includes(n.slug)) expect(n.isDemo).toBe(false);
      else expect(n.title).toMatch(/\(Demo\)/);
    }
    const dolce = nights.find((n) => n.slug === "la-dolce-vita-80s")!;
    expect(dolce).toMatchObject({ theme: "aegean", timeTbc: true, lineup: ["DJ Luna", "DJ Monish"] });
  });

  it("stores only a SHA-256 hash for the seeded coin with confirmed RSVP", async () => {
    const [coin] = await h.db.select().from(t.coins);
    expect(coin.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(coin).toMatchObject({
      serial: 1,
      engraving: "MEERA",
      status: "claimed",
      rsvpStatus: "confirmed",
    });
  });
});

describe("guest-list capacity constraint", () => {
  it("rejects any write that would exceed event guest-list capacity", async () => {
    const [gold] = await h.db.select().from(t.events).where(eq(t.events.slug, "the-gold-room"));
    await expect(
      h.db.update(t.events).set({ confirmedCount: gold.capacity + 1 }).where(eq(t.events.id, gold.id)),
    ).rejects.toThrow();
    await expect(
      h.db.update(t.events).set({ confirmedCount: -1 }).where(eq(t.events.id, gold.id)),
    ).rejects.toThrow();
  });

  it("keeps concurrent transactions from interleaving with other queries", async () => {
    await h.db.insert(t.demoSettings).values({ key: "counter", value: 0 });
    const bump = () =>
      h.db.transaction(async (tx) => {
        const [row] = await tx.select().from(t.demoSettings).where(eq(t.demoSettings.key, "counter"));
        await new Promise((r) => setTimeout(r, 2));
        await tx.update(t.demoSettings).set({ value: Number(row.value) + 1 }).where(eq(t.demoSettings.key, "counter"));
      });
    const stray = () =>
      h.db
        .update(t.demoSettings)
        .set({ value: sql`to_jsonb((${t.demoSettings.value})::text::int + 100)` })
        .where(eq(t.demoSettings.key, "counter"));
    await Promise.all([bump(), stray(), bump(), bump(), stray(), bump()]);
    const [row] = await h.db.select().from(t.demoSettings).where(eq(t.demoSettings.key, "counter"));
    expect(Number(row.value)).toBe(204);
  });
});

describe("public nights", () => {
  it("lists the two upcoming demo Saturdays and the real NYE night as past", async () => {
    const { upcoming, past } = await listPublicNights(h.db, ANONYMOUS);
    expect(upcoming.map((n) => n.title)).toEqual(["Underdogs Saturday (Demo)", "Underdogs Saturday (Demo)"]);
    expect(upcoming.every((n) => n.sortmysceneUrl === "https://sortmyscene.com/p/underdogs-entertainment")).toBe(true);
    expect(past.map((n) => n.slug)).toEqual(["underdogs-wonderland-nye-2026"]);
  });

  it("never returns an Innercircle night through the public API", async () => {
    await expect(getPublicNight(h.db, ANONYMOUS, { slug: "the-gold-room" })).rejects.toSatisfy((e) =>
      isDomainError(e, "not_found"),
    );
  });
});
