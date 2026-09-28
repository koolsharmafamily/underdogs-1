import type { Metadata } from "next";
import { getActor } from "@/lib/auth/request";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { can } from "@/lib/domain/actor";
import { getCrewDashboard } from "@/lib/domain/innercircle";
import { isDemoMode } from "@/lib/env";
import { CrewClient } from "./CrewClient";

export const metadata: Metadata = {
  title: "Crew Console",
  robots: { index: false, follow: false },
};

export default async function CrewPage() {
  const db = await getDb();
  const actor = await getActor(db);

  if (!can(actor, "review_requests")) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <CrewClient authorized={false} isDemo={isDemoMode()} />
      </div>
    );
  }

  const data = await getCrewDashboard(db, actor);
  const currentNow = await now(db);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <CrewClient
        authorized={true}
        nowIso={currentNow.toISOString()}
        actorRole={actor.kind === "guest" ? actor.role : "crew"}
        actorName={actor.kind === "guest" ? (actor.name ?? "Crew Member") : "Crew Member"}
        requests={data.requests.map((r) => ({
          id: r.id,
          name: r.name,
          instagramHandle: r.instagramHandle,
          answers: r.answers,
          vouchCode: r.vouchCode,
          status: r.status,
          aiSummary: r.aiSummary ?? null,
          crewNotes: r.crewNotes,
          createdAtIso: r.createdAt.toISOString(),
        }))}
        coins={data.coins.map((c) => ({
          id: c.id,
          serial: c.serial,
          engraving: c.engraving,
          plusOnes: c.plusOnes,
          status: c.status,
          rsvpStatus: c.rsvpStatus,
          claimDetails: c.claimDetails,
          intendedPhone: c.intendedPhone,
          guestName: c.guestName,
          guestPhone: c.guestPhone,
          claimedAtIso: c.claimedAt ? c.claimedAt.toISOString() : null,
          createdAtIso: c.createdAt.toISOString(),
        }))}
        waitlists={data.waitlists.map((w) => ({
          id: w.id,
          status: w.status,
          guestName: w.guestName,
          guestPhone: w.guestPhone,
          offeredAtIso: w.offeredAt ? w.offeredAt.toISOString() : null,
          offerExpiresAtIso: w.offerExpiresAt ? w.offerExpiresAt.toISOString() : null,
          createdAtIso: w.createdAt.toISOString(),
        }))}
        nights={data.nights.map((n) => ({
          id: n.id,
          slug: n.slug,
          kind: n.kind,
          status: n.status,
          title: n.title,
          tagline: n.tagline,
          theme: n.theme,
          soundTags: n.soundTags,
          dressCode: n.dressCode,
          capacity: n.capacity,
          confirmedCount: n.confirmedCount,
          startsAtIso: n.startsAt.toISOString(),
          endsAtIso: n.endsAt.toISOString(),
          timezone: n.timezone,
          dropAtIso: n.dropAt ? n.dropAt.toISOString() : null,
          dropFiredAtIso: n.dropFiredAt ? n.dropFiredAt.toISOString() : null,
          venueName: n.venueName,
          venueArea: n.venueArea,
          venueAddress: n.venueAddress,
          venueMapsUrl: n.venueMapsUrl,
        }))}
        faqs={data.faqs.map((f) => ({
          id: f.id,
          key: f.key,
          question: f.question,
          answer: f.answer,
          sort: f.sort,
          isDemo: f.isDemo,
        }))}
        outbox={data.outbox.map((m) => ({
          id: m.id,
          toPhone: m.toPhone,
          template: m.template,
          body: m.body,
          coinUrl: m.vars?.coinUrl,
          createdAtIso: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
