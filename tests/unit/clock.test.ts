import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getClockOffsetMs, now, setClockOffsetMs, setTimeSourceForTests } from "@/lib/clock";
import type { DbHandle } from "@/lib/db";
import { ANONYMOUS } from "@/lib/domain/actor";
import { travelTime } from "@/lib/domain/demo";
import { isDomainError } from "@/lib/domain/errors";
import { TODAY, freshDb } from "./helpers";

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

describe("clock", () => {
  it("reads the pinned wall clock with no offset", async () => {
    expect((await now(h.db)).toISOString()).toBe(TODAY.toISOString());
  });

  it("applies the demo offset in demo mode", async () => {
    await setClockOffsetMs(h.db, 3600_000);
    expect((await now(h.db)).getTime()).toBe(TODAY.getTime() + 3600_000);
  });

  it("ignores the offset when demo mode is off", async () => {
    await setClockOffsetMs(h.db, 3600_000);
    process.env.DEMO_MODE = "false";
    expect(await getClockOffsetMs(h.db)).toBe(0);
    expect((await now(h.db)).toISOString()).toBe(TODAY.toISOString());
  });
});

describe("time travel", () => {
  it("adds an hour at a time and resets", async () => {
    await travelTime(h.db, ANONYMOUS, { to: "plus_hour" });
    const later = await travelTime(h.db, ANONYMOUS, { to: "plus_hour" });
    expect(later.getTime()).toBe(TODAY.getTime() + 2 * 3600_000);
    const back = await travelTime(h.db, ANONYMOUS, { to: "reset" });
    expect(back.toISOString()).toBe(TODAY.toISOString());
  });

  it("jumps to one second past the Gold Room drop, then to doors", async () => {
    const drop = await travelTime(h.db, ANONYMOUS, { to: "to_drop" });
    expect(drop.toISOString()).toBe("2026-10-07T15:30:01.000Z"); // Wed 7 Oct, 9 PM IST
    const doors = await travelTime(h.db, ANONYMOUS, { to: "to_doors" });
    expect(doors.toISOString()).toBe("2026-10-10T15:30:01.000Z"); // Sat 10 Oct, 9 PM IST
  });

  it("refuses outside demo mode", async () => {
    process.env.DEMO_MODE = "false";
    await expect(travelTime(h.db, ANONYMOUS, { to: "plus_hour" })).rejects.toSatisfy((e) =>
      isDomainError(e, "demo_only"),
    );
  });
});
