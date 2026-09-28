import type { Metadata } from "next";
import Link from "next/link";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { factsLine } from "@/components/nights/NightCard";
import { dateBlock, formatDate, formatTime, toIsoWithOffset, zoneLabel } from "@/lib/dates";
import type { PublicNight } from "@/lib/domain/events";
import { appUrl } from "@/lib/env";
import { INSTAGRAM_UNDERDOGS, ORGANISER } from "@/lib/site";
import { loadPublicNight } from "./load";

export async function generateMetadata({ params }: PageProps<"/nights/[slug]">): Promise<Metadata> {
  const night = await loadPublicNight((await params).slug);
  const description = [night.tagline, factsLine(night).slice(1).join(" · ")].filter(Boolean).join(" ");
  return {
    title: night.title,
    description,
    alternates: { canonical: `/nights/${night.slug}` },
    openGraph: { title: night.title, description, type: "website" },
  };
}

/** schema.org Event with real IST offsets. */
function eventJsonLd(night: PublicNight) {
  const url = new URL(`/nights/${night.slug}`, appUrl()).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: night.title,
    description: night.description ?? night.tagline ?? undefined,
    url,
    image: [new URL(`/nights/${night.slug}/opengraph-image`, appUrl()).toString()],
    startDate: toIsoWithOffset(night.startsAt, night.timezone),
    endDate: toIsoWithOffset(night.endsAt, night.timezone),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    typicalAgeRange: night.minAge ? `${night.minAge}-` : undefined,
    location: {
      "@type": "Place",
      name: night.venue?.name ?? "To be announced",
      address: {
        "@type": "PostalAddress",
        streetAddress: night.venue?.address ?? undefined,
        addressLocality: night.venue?.city ?? "Nagpur",
        addressRegion: "Maharashtra",
        addressCountry: "IN",
      },
    },
    organizer: { "@type": "Organization", name: ORGANISER, url: INSTAGRAM_UNDERDOGS },
    offers: night.sortmysceneUrl
      ? { "@type": "Offer", url: night.sortmysceneUrl, availability: "https://schema.org/InStock" }
      : undefined,
  };
}

export default async function NightPage({ params }: PageProps<"/nights/[slug]">) {
  const night = await loadPublicNight((await params).slug);
  const block = dateBlock(night.startsAt, night.timezone);
  const tz = zoneLabel(night.timezone);

  const details: [string, string][] = [
    ["When", night.timeTbc ? formatDate(night.startsAt, night.timezone) : `${formatDate(night.startsAt, night.timezone)}, ${formatTime(night.startsAt, night.timezone)} to ${formatTime(night.endsAt, night.timezone)} ${tz}`],
    ["Where", night.venue ? [night.venue.name, night.venue.area, night.venue.city].filter(Boolean).join(", ") : "To be announced"],
    ...(night.soundTags.length ? [["Sound", night.soundTags.join(", ")] as [string, string]] : []),
    ...(night.lineup.length ? [["Lineup", night.lineup.join(", ")] as [string, string]] : []),
    ...(night.dressCode ? [["Dress code", night.dressCode] as [string, string]] : []),
    ...(night.minAge ? [["Age", `${night.minAge}+, ID at the door`] as [string, string]] : []),
  ];

  return (
    <article className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 lg:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(night)).replace(/</g, "\\u003c") }}
      />
      <Link href="/nights" className="text-sm text-accent-muted hover:text-accent">
        <span aria-hidden>←</span> All nights
      </Link>

      <header className="mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">
            {block.weekday} {block.day} {block.month} {block.year}
          </p>
          {night.isDemo ? <DemoTag /> : null}
          {night.isPast ? <span className="demo-tag">Been and gone</span> : null}
        </div>
        <h1 className="font-serif text-4xl leading-tight text-heading sm:text-5xl">{night.title}</h1>
        {night.tagline ? <p className="font-serif text-xl text-text sm:text-2xl">{night.tagline}</p> : null}
      </header>

      <Frame className="mt-8" bodyClassName="p-5 sm:p-7">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-[8rem_1fr]">
          {details.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="eyebrow pt-0.5">{k}</dt>
              <dd className="text-text">{v}</dd>
            </div>
          ))}
        </dl>
        {night.timeTbc ? (
          <p className="mt-5 text-sm text-text-dim">Only the date is on record for this night.</p>
        ) : null}
      </Frame>

      {night.description ? <p className="mt-8 text-lg text-text-dim">{night.description}</p> : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {night.sortmysceneUrl && !night.isPast ? (
          <a href={night.sortmysceneUrl} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
            Tickets on SortMyScene <span aria-hidden>↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        {night.instagramUrl ? (
          <a href={night.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            On Instagram <span aria-hidden>↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
