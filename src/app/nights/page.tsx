import type { Metadata } from "next";
import Link from "next/link";
import { NightCard } from "@/components/nights/NightCard";
import { getActor } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { listPublicNights } from "@/lib/domain/events";
import { SORTMYSCENE_ORGANISER_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Nights",
  description: "Public Underdogs nights in Nagpur. Loud, themed and open to all, with tickets on SortMyScene.",
};

export default async function NightsPage() {
  const db = await getDb();
  const { upcoming, past } = await listPublicNights(db, await getActor(db));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 lg:pt-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <p className="eyebrow">Heads: the rage</p>
        <h1 className="font-serif text-4xl text-heading sm:text-5xl">Underdogs nights</h1>
        <p className="text-lg text-text-dim">
          Loud. Themed. Open to all. Tickets stay on{" "}
          <a href={SORTMYSCENE_ORGANISER_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            SortMyScene
          </a>
          .
        </p>
      </header>

      <section aria-labelledby="upcoming" className="mt-10">
        <h2 id="upcoming" className="sr-only">
          Coming up
        </h2>
        {upcoming.length ? (
          <ul className="grid gap-5 md:grid-cols-2">
            {upcoming.map((night) => (
              <li key={night.slug} className="relative">
                <NightCard night={night} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-dim">No public nights on the calendar yet. Watch @underdogs_nagpur.</p>
        )}
      </section>

      <aside className="mt-14 flex flex-col items-start gap-3 border-l border-rule pl-5">
        <p className="eyebrow">Tails: the room</p>
        <p className="max-w-xl font-serif text-2xl text-text">
          Behind the rage there is a smaller room. Invite only, details inside the circle.
        </p>
        <Link href="/innercircle" className="btn btn-ghost">
          The Innercircle
        </Link>
      </aside>

      {past.length ? (
        <section aria-labelledby="past" className="mt-16">
          <h2 id="past" className="eyebrow mb-5">
            Been and gone
          </h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {past.map((night) => (
              <li key={night.slug} className="relative">
                <NightCard night={night} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
