import type { Metadata } from "next";
import { getActor } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { getMyStatus } from "@/lib/domain/innercircle";
import { MeClient } from "./MeClient";

export const metadata: Metadata = {
  title: "Your Coin",
  robots: { index: false, follow: false },
};

export default async function MePage() {
  const db = await getDb();
  const actor = await getActor(db);

  if (actor.kind !== "guest") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <MeClient mode="signin" />
      </div>
    );
  }

  const status = await getMyStatus(db, actor);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <MeClient
        mode="dashboard"
        guestName={actor.name}
        guestPhone={actor.phone}
        coins={status.coins.map((c) => ({
          id: c.id,
          serialFormatted: c.serialFormatted,
          engraving: c.engraving,
          status: c.status,
          rsvpStatus: c.rsvpStatus,
          plusOnes: c.plusOnes,
        }))}
        requests={status.requests.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          createdAtIso: r.createdAt.toISOString(),
        }))}
        waitlists={status.waitlists.map((w) => ({
          id: w.id,
          status: w.status,
        }))}
        messages={status.messages.map((m) => ({
          id: m.id,
          template: m.template,
          body: m.body,
          coinUrl: m.vars?.coinUrl,
          createdAtIso: m.createdAt.toISOString(),
        }))}
        nextNight={
          status.nextNight
            ? {
                slug: status.nextNight.slug,
                title: status.nextNight.title,
                hasDropped: status.nextNight.hasDropped,
                venue: status.nextNight.venue,
              }
            : null
        }
      />
    </div>
  );
}
