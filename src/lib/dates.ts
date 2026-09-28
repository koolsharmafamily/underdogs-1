/*
  Pure date helpers. No "now" in here: callers pass instants from lib/clock.ts.
  Events store UTC instants plus an IANA timezone (Asia/Kolkata for every seeded night).
*/

export const IST = "Asia/Kolkata";

export type LocalDate = { year: number; month: number; day: number }; // month is 1-12
export type LocalDateTime = LocalDate & { hour: number; minute: number };

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading of an instant in a timezone. */
export function toLocal(instant: Date, timeZone: string): LocalDateTime & { second: number } {
  const parts = Object.fromEntries(
    partsFormatter(timeZone)
      .formatToParts(instant)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Offset of a timezone from UTC at an instant, in minutes (IST is +330). */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const l = toLocal(instant, timeZone);
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** The UTC instant of a wall-clock time in a timezone. */
export function fromLocal(local: LocalDateTime, timeZone: string): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  // Second pass settles DST edges; a no-op for fixed-offset zones like IST.
  return new Date(guess - offsetMinutes(new Date(first), timeZone) * 60_000);
}

/** Calendar arithmetic on a local date (no timezone involved). */
export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** The first Saturday on or after `today + minDays` (local calendar dates). */
export function firstSaturdayAtLeast(today: LocalDate, minDays: number): LocalDate {
  const earliest = addDays(today, minDays);
  return addDays(earliest, (6 - weekday(earliest) + 7) % 7);
}

/** ISO 8601 with the zone's offset, e.g. 2026-10-10T21:00:00+05:30 (for schema.org). */
export function toIsoWithOffset(instant: Date, timeZone: string): string {
  const l = toLocal(instant, timeZone);
  const off = offsetMinutes(instant, timeZone);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${l.year}-${p(l.month)}-${p(l.day)}T${p(l.hour)}:${p(l.minute)}:${p(l.second)}` +
    `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`
  );
}

// ── Display ──────────────────────────────────────────────────────────────

/** "Sat 10 Oct 2026" */
export function formatDate(instant: Date, timeZone: string): string {
  // Built from parts: ICU versions disagree on the comma after the weekday.
  const b = dateBlock(instant, timeZone);
  const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  return `${title(b.weekday)} ${b.day} ${title(b.month)} ${b.year}`;
}

/** "9 PM" or "9:30 PM" */
export function formatTime(instant: Date, timeZone: string): string {
  const l = toLocal(instant, timeZone);
  const h12 = l.hour % 12 || 12;
  const suffix = l.hour < 12 ? "AM" : "PM";
  return l.minute === 0 ? `${h12} ${suffix}` : `${h12}:${String(l.minute).padStart(2, "0")} ${suffix}`;
}

/** Short zone label for display; IST is the only one the seed uses. */
export function zoneLabel(timeZone: string): string {
  return timeZone === IST ? "IST" : timeZone;
}

/** { weekday: "SAT", day: "10", month: "OCT" } for the Cinzel date block. */
export function dateBlock(instant: Date, timeZone: string) {
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, ...o }).format(instant).toUpperCase();
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }), year: f({ year: "numeric" }) };
}
