import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { GoldieChat } from "@/components/goldie/GoldieChat";
import { getActor } from "@/lib/auth/request";
import { dateBlock, formatDate, formatTime, zoneLabel } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { isDomainError } from "@/lib/domain/errors";
import { getInnercircleNight } from "@/lib/domain/innercircle";
import { themeFor } from "@/themes";

export const metadata: Metadata = {
  title: "Innercircle Night",
  robots: { index: false, follow: false },
};

export default async function InnercircleNightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const actor = await getActor(db);

  let night;
  try {
    night = await getInnercircleNight(db, actor, { slug });
  } catch (e) {
    if (isDomainError(e, "not_found")) notFound();
    throw e;
  }

  const b = dateBlock(night.startsAt, night.timezone);
  const world = themeFor(night.theme);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <div>
        <Link href="/innercircle" className="text-sm text-accent hover:underline">
          ← Back to Innercircle
        </Link>
      </div>

      <Frame bodyClassName="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Innercircle · {world.name} World</span>
              {night.isDemo ? <DemoTag /> : null}
            </div>
            <h1 className="mt-2 font-night text-3xl leading-tight text-heading sm:text-5xl">{night.title}</h1>
            {night.tagline ? <p className="mt-2 font-serif text-xl text-text-dim">{night.tagline}</p> : null}
          </div>
          <div className="text-right font-display leading-none text-accent" aria-hidden>
            <div className="text-xs tracking-[0.2em] text-accent-muted">{b.weekday}</div>
            <div className="mt-1 text-4xl">{b.day}</div>
            <div className="mt-1 text-xs tracking-[0.2em]">{b.month}</div>
          </div>
        </div>

        {night.description ? <p className="text-text-dim">{night.description}</p> : null}

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="eyebrow">When</dt>
            <dd className="mt-1 text-text">
              {formatDate(night.startsAt, night.timezone)}
              <br />
              {formatTime(night.startsAt, night.timezone)} {zoneLabel(night.timezone)}
            </dd>
          </div>

          {night.soundTags.length ? (
            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <dt className="eyebrow">Sound</dt>
              <dd className="mt-1 text-text">{night.soundTags.join(", ")}</dd>
            </div>
          ) : null}

          {night.dressCode ? (
            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <dt className="eyebrow">Dress code</dt>
              <dd className="mt-1 text-text">{night.dressCode}</dd>
            </div>
          ) : null}

          {night.doorPolicy ? (
            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <dt className="eyebrow">Access policy</dt>
              <dd className="mt-1 text-text">{night.doorPolicy}</dd>
            </div>
          ) : null}

          {night.minAge ? (
            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <dt className="eyebrow">Minimum age</dt>
              <dd className="mt-1 text-text">{night.minAge}+ (Government photo ID required)</dd>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-surface-raised p-4">
            <dt className="eyebrow">Room curation</dt>
            <dd className="mt-1 text-text">
              {night.confirmedCount} / {night.capacity} confirmed RSVPs
            </dd>
          </div>
        </dl>

        {/* Timed Location Drop Panel */}
        <div
          data-testid="location-drop-panel"
          className={`rounded-2xl border p-6 ${
            night.venue ? "border-rule bg-surface-raised" : "border-border bg-bg"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="eyebrow">
              {night.venue ? "The Drop · Venue Revealed" : "The Drop · Secret Location"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                night.venue ? "bg-drop text-text" : "border border-rule text-accent-muted"
              }`}
            >
              {night.venue ? "Location Dropped 📍" : "Redacted 🔒"}
            </span>
          </div>

          {night.venue ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl text-heading">{night.venue.name}</h2>
                <p className="mt-1 text-sm text-text">
                  {[night.venue.address, night.venue.area, night.venue.city].filter(Boolean).join(", ")}
                </p>
              </div>
              {night.venue.mapsUrl ? (
                <a
                  href={night.venue.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-gold shrink-0"
                >
                  Open in Google Maps ↗
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <h2 className="font-serif text-2xl text-heading">
                The night is set. The address isn&apos;t.
              </h2>
              <p className="text-sm text-text-dim">
                {night.dropAt
                  ? `The venue drops on ${formatDate(night.dropAt, night.timezone)} at ${formatTime(night.dropAt, night.timezone)} ${zoneLabel(night.timezone)} to guests whose coin RSVP has been confirmed by the Innercircle crew.`
                  : "The exact venue drops before doors to confirmed Innercircle coin-holders."}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/innercircle#request-form" className="btn btn-gold">
                  Request your coin
                </Link>
                <Link href="/me" className="btn btn-ghost">
                  Check your coin &amp; RSVP status
                </Link>
              </div>
            </div>
          )}
        </div>
      </Frame>

      <section aria-labelledby="event-goldie-heading" className="flex flex-col gap-4">
        <h2 id="event-goldie-heading" className="font-serif text-2xl text-heading">
          Ask Goldie about {night.title}
        </h2>
        <GoldieChat context={{ mode: "event", slug: night.slug }} />
      </section>
    </div>
  );
}
