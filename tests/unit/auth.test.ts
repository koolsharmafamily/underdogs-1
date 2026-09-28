import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/auth/session";
import { setClockOffsetMs, setTimeSourceForTests } from "@/lib/clock";
import type { DbHandle } from "@/lib/db";
import { guests } from "@/lib/db/schema";
import { ANONYMOUS, assertCan, can, system, type Actor } from "@/lib/domain/actor";
import { OTP_MAX_ATTEMPTS, requestOtp, verifyOtp } from "@/lib/domain/auth";
import { isDomainError } from "@/lib/domain/errors";
import { resolveActor } from "@/lib/domain/guests";
import { normalisePhone } from "@/lib/phone";
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

const code = (e: unknown) => (isDomainError(e) ? e.code : String(e));

describe("phone numbers", () => {
  it("normalises Indian mobiles to E.164 and rejects the rest", () => {
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
    expect(normalisePhone("+91 98765-43210")).toBe("+919876543210");
    expect(normalisePhone("098765 43210")).toBe("+919876543210");
    expect(normalisePhone("919876543210")).toBe("+919876543210");
    expect(normalisePhone("12345 67890")).toBeNull();
    expect(normalisePhone("98765")).toBeNull();
  });
});

describe("OTP", () => {
  it("signs a new number in and creates the guest", async () => {
    const sent = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00001" });
    expect(sent.demoCode).toMatch(/^\d{6}$/);
    const result = await verifyOtp(h.db, ANONYMOUS, { phone: "+91 98111 00001", code: sent.demoCode!, name: "Test (Demo)" });
    expect(result.isNew).toBe(true);
    const [g] = await h.db.select().from(guests).where(eq(guests.id, result.guestId));
    expect(g).toMatchObject({ phone: "+919811100001", name: "Test (Demo)", role: "guest" });
    expect(g.phoneVerifiedAt).not.toBeNull();
  });

  it("signs an existing guest back in without duplicating them", async () => {
    const sent = await requestOtp(h.db, ANONYMOUS, { phone: "+919000010001" });
    const result = await verifyOtp(h.db, ANONYMOUS, { phone: "9000010001", code: sent.demoCode! });
    expect(result.isNew).toBe(false);
    const actor = await resolveActor(h.db, result.guestId);
    expect(actor).toMatchObject({ kind: "guest", name: "Aarav (Demo)", role: "guest" });
  });

  it("spends a code once", async () => {
    const sent = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00002" });
    await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00002", code: sent.demoCode! });
    const again = await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00002", code: sent.demoCode! }).catch(code);
    expect(again).toBe("expired");
  });

  it("only accepts the newest code", async () => {
    const first = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00003" });
    const second = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00003" });
    if (first.demoCode !== second.demoCode) {
      expect(await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00003", code: first.demoCode! }).catch(code)).toBe("invalid");
    }
    await expect(verifyOtp(h.db, ANONYMOUS, { phone: "98111 00003", code: second.demoCode! })).resolves.toBeTruthy();
  });

  it("locks after five wrong tries, even for the right code", async () => {
    const sent = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00004" });
    const wrong = sent.demoCode === "000000" ? "111111" : "000000";
    const results: string[] = [];
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      results.push((await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00004", code: wrong }).catch(code)) as string);
    }
    expect(results.slice(0, -1).every((r) => r === "invalid")).toBe(true);
    expect(results.at(-1)).toBe("locked");
    expect(await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00004", code: sent.demoCode! }).catch(code)).toBe("locked");
  });

  it("expires after five minutes on the demo clock", async () => {
    const sent = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00005" });
    await setClockOffsetMs(h.db, 5 * 60_000 + 1);
    expect(await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00005", code: sent.demoCode! }).catch(code)).toBe("expired");
  });

  it("limits codes per number per hour", async () => {
    for (let i = 0; i < 5; i++) await requestOtp(h.db, ANONYMOUS, { phone: "98111 00006" });
    expect(await requestOtp(h.db, ANONYMOUS, { phone: "98111 00006" }).catch(code)).toBe("locked");
  });

  it("does not return the code outside demo mode", async () => {
    process.env.DEMO_MODE = "false";
    process.env.SESSION_SECRET = "test-secret-for-non-demo-mode-000000";
    try {
      const sent = await requestOtp(h.db, ANONYMOUS, { phone: "98111 00007" });
      expect(sent.demoCode).toBeUndefined();
    } finally {
      delete process.env.SESSION_SECRET;
    }
  });

  it("rejects malformed input", async () => {
    expect(await requestOtp(h.db, ANONYMOUS, { phone: "hello" }).catch(code)).toBe("invalid");
    expect(await verifyOtp(h.db, ANONYMOUS, { phone: "98111 00001", code: "12ab" }).catch(code)).toBe("invalid");
  });
});

describe("sessions", () => {
  it("round-trips a guest id and rejects tampering", async () => {
    const token = await signSession(h.db, "00000000-0000-4000-8000-000000000001");
    expect(await verifySession(h.db, token)).toBe("00000000-0000-4000-8000-000000000001");
    const [head, body, sig] = token.split(".");
    const flipped = sig.slice(0, -2) + (sig.at(-2) === "A" ? "B" : "A") + sig.at(-1);
    expect(await verifySession(h.db, `${head}.${body}.${flipped}`)).toBeNull();
    expect(await verifySession(h.db, "not-a-token")).toBeNull();
  });

  it("expires after 30 days on the demo clock", async () => {
    const token = await signSession(h.db, "00000000-0000-4000-8000-000000000002");
    await setClockOffsetMs(h.db, 31 * 86_400_000);
    expect(await verifySession(h.db, token)).toBeNull();
  });

  it("treats a deleted guest as anonymous", async () => {
    const [g] = await h.db.select().from(guests).where(eq(guests.phone, "+919000010003"));
    await h.db.update(guests).set({ deletedAt: new Date() }).where(eq(guests.id, g.id));
    expect(await resolveActor(h.db, g.id)).toEqual(ANONYMOUS);
    await h.db.update(guests).set({ deletedAt: null }).where(eq(guests.id, g.id));
  });
});

describe("roles", () => {
  const as = (role: "guest" | "crew" | "admin"): Actor => ({
    kind: "guest",
    guestId: "x",
    role,
    name: null,
    phone: "+919000000000",
  });

  it("grants each capability only to the right roles", () => {
    expect(can(as("guest"), "review_requests")).toBe(false);
    expect(can(as("crew"), "review_requests")).toBe(true);
    expect(can(as("admin"), "review_requests")).toBe(true);
    expect(can(as("guest"), "see_venues")).toBe(false);
    expect(can(ANONYMOUS, "review_requests")).toBe(false);
    expect(can(system("cron"), "see_venues")).toBe(true);
  });

  it("tells anonymous and forbidden apart", () => {
    const err = (a: Actor) => {
      try {
        assertCan(a, "manage_nights");
        return "ok";
      } catch (e) {
        return code(e);
      }
    };
    expect(err(ANONYMOUS)).toBe("unauthenticated");
    expect(err(as("guest"))).toBe("forbidden");
    expect(err(as("admin"))).toBe("ok");
  });
});
