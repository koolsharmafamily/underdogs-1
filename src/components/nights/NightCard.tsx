import Link from "next/link";
import { dateBlock, formatDate, formatTime, zoneLabel } from "@/lib/dates";
import type { PublicNight } from "@/lib/domain/events";
import { DemoTag, Frame } from "../brand/Frame";

/** "Open to all | Sat 17 Oct 2026, 10 PM IST | Venue to be announced (Demo), Nagpur" */
export function factsLine(night: PublicNight): string[] {
  const when = night.timeTbc
    ? formatDate(night.startsAt, night.timezone)
    : `${formatDate(night.startsAt, night.timezone)}, ${formatTime(night.startsAt, night.timezone)} ${zoneLabel(night.timezone)}`;
  const where = night.venue ? [night.venue.name, night.venue.city].filter(Boolean).join(", ") : "Venue to be announced";
  return ["Open to all", when, where];
}

export function NightCard({ night }: { night: PublicNight }) {
  const block = dateBlock(night.startsAt, night.timezone);
  return (
    <Frame className="h-full" bodyClassName="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="font-display leading-none text-accent" aria-hidden>
          <div className="text-xs tracking-[0.2em] text-accent-muted">{block.weekday}</div>
          <div className="mt-1 text-4xl">{block.day}</div>
          <div className="mt-1 text-sm tracking-[0.2em]">
            {block.month} {block.year}
          </div>
        </div>
        {night.isDemo ? <DemoTag /> : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-2xl leading-tight text-heading">
          <Link href={`/nights/${night.slug}`} className="after:absolute after:inset-0 hover:underline">
            {night.title}
          </Link>
        </h3>
        {night.tagline ? <p className="text-text-dim">{night.tagline}</p> : null}
        <p className="text-sm text-text-dim">
          {factsLine(night).map((part, i) => (
            <span key={part}>
              {i > 0 ? <span className="px-1.5 text-rule" aria-hidden>|</span> : null}
              {i > 0 ? <span className="sr-only">, </span> : null}
              {i === 1 ? <span className="whitespace-nowrap">{part}</span> : part}
            </span>
          ))}
        </p>
      </div>

      {night.soundTags.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Sound">
          {night.soundTags.map((tag) => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {night.sortmysceneUrl && !night.isPast ? (
        <div className="relative z-10 mt-auto">
          <a href={night.sortmysceneUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
            Tickets on SortMyScene <span aria-hidden>↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      ) : null}
    </Frame>
  );
}
