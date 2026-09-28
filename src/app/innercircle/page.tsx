import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { getActor } from "@/lib/auth/request";
import { formatDate, formatTime, zoneLabel } from "@/lib/dates";
import { getDb } from "@/lib/db";
import * as t from "@/lib/db/schema";
import { getNextInnercircleTeaser, listFaqs } from "@/lib/domain/innercircle";
import { RequestFormClient } from "./RequestFormClient";

export const metadata: Metadata = {
  title: "The Innercircle",
  description: "The room behind the rage. How the invite-only Innercircle works and how to request your coin.",
};

export default async function InnercirclePage() {
  const db = await getDb();
  const actor = await getActor(db);
  const [next, faqs] = await Promise.all([
    getNextInnercircleTeaser(db, actor),
    listFaqs(db, actor),
  ]);

  let existingStatus: string | null = null;
  if (actor.kind === "guest") {
    const [latest] = await db
      .select({ status: t.inviteRequests.status })
      .from(t.inviteRequests)
      .where(eq(t.inviteRequests.guestId, actor.guestId))
      .orderBy(desc(t.inviteRequests.createdAt))
      .limit(1);
    existingStatus = latest?.status ?? null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <p className="eyebrow">Nagpur · Invite-only community</p>
        <h1 className="font-serif text-4xl leading-tight text-heading sm:text-6xl">
          The room behind the rage.
        </h1>
        <p className="text-lg text-text-dim">
          Underdogs throws the loud, open-gate themed nights across Nagpur. The Innercircle is the smaller room behind
          it — built for our most active regulars, where every guest is reviewed by the crew, every coin is personal,
          and the venue stays under wraps until the drop.
        </p>
      </header>

      {next ? (
        <Frame bodyClassName="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Next Innercircle Night</span>
              {next.isDemo ? <DemoTag /> : null}
            </div>
            <h2 className="mt-1 font-night text-2xl text-heading sm:text-3xl">{next.title}</h2>
            <p className="mt-1 text-sm text-text-dim">
              {formatDate(next.startsAt, next.timezone)} · {formatTime(next.startsAt, next.timezone)}{" "}
              {zoneLabel(next.timezone)} · Dress code: {next.dressCode ?? "TBA"}
            </p>
            <p className="mt-1 text-xs text-accent">
              {next.hasDropped ? "Location has dropped to confirmed coin-holders 🔒" : "Location drops 72 hours before doors 🔒"}
            </p>
          </div>
          <Link href={`/innercircle/${next.slug}`} className="btn btn-ghost shrink-0">
            View night page →
          </Link>
        </Frame>
      ) : null}

      <section id="request-form" aria-labelledby="request-heading" className="scroll-mt-8">
        <h2 id="request-heading" className="sr-only">
          Request an invite
        </h2>
        <RequestFormClient
          actor={actor.kind === "guest" ? actor : { kind: "anonymous" }}
          existingStatus={existingStatus}
        />
      </section>

      <section aria-labelledby="faq-heading" className="flex flex-col gap-6">
        <div>
          <p className="eyebrow">House rules</p>
          <h2 id="faq-heading" className="mt-1 font-serif text-3xl text-heading">
            Frequently asked questions
          </h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.key} className="rounded-2xl border border-border bg-surface/85 p-5">
              <dt className="font-serif text-xl text-heading">{f.question}</dt>
              <dd className="mt-2 text-sm text-text-dim">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
