import { describe, expect, it } from "vitest";
import {
  IST,
  firstSaturdayAtLeast,
  formatDate,
  formatTime,
  fromLocal,
  toIsoWithOffset,
  toLocal,
  weekday,
} from "@/lib/dates";
import { seedCalendar } from "@/lib/db/seed";

describe("dates", () => {
  it("converts IST wall-clock times to UTC and back", () => {
    const utc = fromLocal({ year: 2026, month: 10, day: 10, hour: 21, minute: 0 }, IST);
    expect(utc.toISOString()).toBe("2026-10-10T15:30:00.000Z");
    expect(toLocal(utc, IST)).toMatchObject({ year: 2026, month: 10, day: 10, hour: 21, minute: 0 });
  });

  it("writes schema.org times with the +05:30 offset", () => {
    expect(toIsoWithOffset(new Date("2026-10-10T15:30:00Z"), IST)).toBe("2026-10-10T21:00:00+05:30");
    // Past midnight IST is the next calendar day.
    expect(toIsoWithOffset(new Date("2026-10-10T21:30:00Z"), IST)).toBe("2026-10-11T03:00:00+05:30");
  });

  it("finds the first Saturday at least N days away", () => {
    // Sunday 27 Sep + 12 = Friday 9 Oct → Saturday 10 Oct.
    expect(firstSaturdayAtLeast({ year: 2026, month: 9, day: 27 }, 12)).toEqual({ year: 2026, month: 10, day: 10 });
    // Monday 28 Sep + 12 = Saturday 10 Oct itself.
    expect(firstSaturdayAtLeast({ year: 2026, month: 9, day: 28 }, 12)).toEqual({ year: 2026, month: 10, day: 10 });
    // Tuesday 29 Sep + 12 = Sunday 11 Oct → Saturday 17 Oct.
    expect(firstSaturdayAtLeast({ year: 2026, month: 9, day: 29 }, 12)).toEqual({ year: 2026, month: 10, day: 17 });
    // Across a month and year boundary.
    expect(firstSaturdayAtLeast({ year: 2026, month: 12, day: 25 }, 12)).toEqual({ year: 2027, month: 1, day: 9 });
    expect(weekday({ year: 2027, month: 1, day: 9 })).toBe(6);
  });

  it("formats dates and times for display in IST", () => {
    const d = new Date("2026-10-10T15:30:00Z");
    expect(formatDate(d, IST)).toBe("Sat 10 Oct 2026");
    expect(formatTime(d, IST)).toBe("9 PM");
    expect(formatTime(new Date("2026-10-10T21:30:00Z"), IST)).toBe("3 AM");
  });
});

describe("seed calendar", () => {
  it("puts the Gold Room on the first Saturday at least 12 days away, 9 PM to 3 AM IST, drop 72 h before", () => {
    const cal = seedCalendar(new Date("2026-09-27T12:00:00+05:30"));
    expect(toIsoWithOffset(cal.goldRoom.startsAt, IST)).toBe("2026-10-10T21:00:00+05:30");
    expect(toIsoWithOffset(cal.goldRoom.endsAt, IST)).toBe("2026-10-11T03:00:00+05:30");
    expect(toIsoWithOffset(cal.goldRoom.dropAt, IST)).toBe("2026-10-07T21:00:00+05:30");
  });

  it("uses the IST calendar date, not the UTC one", () => {
    // 00:30 IST on Monday 28 Sep is still Sunday 27 Sep in UTC.
    const cal = seedCalendar(new Date("2026-09-28T00:30:00+05:30"));
    expect(toIsoWithOffset(cal.goldRoom.startsAt, IST)).toBe("2026-10-10T21:00:00+05:30");
  });

  it("puts the two public Saturdays on the two Saturdays after the Gold Room, 10 PM to 3 AM", () => {
    const cal = seedCalendar(new Date("2026-09-27T12:00:00+05:30"));
    expect(cal.publicNights.map((n) => toIsoWithOffset(n.startsAt, IST))).toEqual([
      "2026-10-17T22:00:00+05:30",
      "2026-10-24T22:00:00+05:30",
    ]);
    expect(cal.publicNights.map((n) => toIsoWithOffset(n.endsAt, IST))).toEqual([
      "2026-10-18T03:00:00+05:30",
      "2026-10-25T03:00:00+05:30",
    ]);
  });
});
