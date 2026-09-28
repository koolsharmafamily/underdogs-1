import type { Metadata } from "next";
import { getActor } from "@/lib/auth/request";
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <CrewClient
        authorized={true}
        requests={data.requests.map((r) => ({
          id: r.id,
          name: r.name,
          instagramHandle: r.instagramHandle,
          answers: r.answers,
          vouchCode: r.vouchCode,
          status: r.status,
          aiSummary: r.aiSummary ?? null,
          crewNotes: r.crewNotes,
        }))}
        coins={data.coins}
        outbox={data.outbox.map((m) => ({
          id: m.id,
          toPhone: m.toPhone,
          template: m.template,
          body: m.body,
          coinUrl: m.vars?.coinUrl,
        }))}
      />
    </div>
  );
}
