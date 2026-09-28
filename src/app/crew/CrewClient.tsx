"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { switchDemoPersona } from "@/app/actions/demo";
import {
  issueDirectCoinAction,
  reviewCoinRsvpAction,
  reviewInviteRequestAction,
} from "@/app/actions/innercircle";
import { DemoTag, Frame } from "@/components/brand/Frame";
import type { CoinClaimDetails, CrewSummary, RequestAnswers } from "@/lib/db/schema";

type RequestItem = {
  id: string;
  name: string;
  instagramHandle: string | null;
  answers: RequestAnswers;
  vouchCode: string | null;
  status: string;
  aiSummary: CrewSummary | null;
  crewNotes: string | null;
};

type CoinItem = {
  id: string;
  serial: number;
  engraving: string;
  plusOnes: number;
  status: string;
  rsvpStatus: string;
  claimDetails: CoinClaimDetails | null;
  intendedPhone: string | null;
  guestName: string | null;
  guestPhone: string | null;
};

type OutboxItem = {
  id: string;
  toPhone: string;
  template: string;
  body: string;
  coinUrl?: string;
};

type Props =
  | {
      authorized: false;
      isDemo: boolean;
    }
  | {
      authorized: true;
      requests: RequestItem[];
      coins: CoinItem[];
      outbox: OutboxItem[];
    };

export function CrewClient(props: Props) {
  const router = useRouter();
  const baseId = useId();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mintedLinks, setMintedLinks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  // Direct invite state
  const [directName, setDirectName] = useState("Rhea (Demo)");
  const [directPhone, setDirectPhone] = useState("+91 90000 10099");
  const [directIg, setDirectIg] = useState("rhea.demo");
  const [directPlusOnes, setDirectPlusOnes] = useState(1);
  const [directResult, setDirectResult] = useState<{ coinUrl: string; serial: number } | null>(null);

  if (!props.authorized) {
    return (
      <Frame bodyClassName="flex max-w-xl flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Crew Console · Restricted</p>
          <DemoTag />
        </div>
        <h1 className="font-serif text-3xl text-heading">Crew Access Only</h1>
        <p className="text-sm text-text-dim">
          The review queue, direct coin minting, and RSVP confirmations require a Crew or Admin account.
        </p>
        {props.isDemo ? (
          <button
            type="button"
            onClick={async () => {
              await switchDemoPersona("admin");
              router.refresh();
            }}
            className="btn btn-gold self-start"
          >
            Switch to Crew / Admin (Demo)
          </button>
        ) : null}
      </Frame>
    );
  }

  async function handleReviewRequest(
    requestId: string,
    decision: "approved" | "waitlisted" | "declined",
    plusOnes = 1,
  ) {
    setBusyId(requestId);
    setFeedback(null);
    const res = await reviewInviteRequestAction({ requestId, decision, plusOnes });
    setBusyId(null);
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    if (res.token) {
      setMintedLinks((prev) => ({ ...prev, [requestId]: `/coin/${res.token}` }));
    }
    router.refresh();
  }

  async function handleReviewRsvp(coinId: string, decision: "confirmed" | "waitlisted" | "declined") {
    setBusyId(coinId);
    setFeedback(null);
    const res = await reviewCoinRsvpAction({ coinId, decision });
    setBusyId(null);
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDirectInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusyId("direct");
    setFeedback(null);
    const res = await issueDirectCoinAction({
      name: directName,
      phone: directPhone,
      instagramHandle: directIg,
      plusOnes: directPlusOnes,
    });
    setBusyId(null);
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setDirectResult({ coinUrl: res.coinUrl, serial: res.serial });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="eyebrow">Underdogs Innercircle · Crew Console</p>
          <h1 className="mt-1 font-serif text-4xl text-heading">Review Queue &amp; Coin Curation</h1>
        </div>
        <DemoTag />
      </header>

      {feedback ? (
        <div role="alert" className="rounded-xl border border-drop bg-surface-raised p-4 text-sm text-drop-text">
          {feedback}
        </div>
      ) : null}

      {/* 1. Invite Requests Review Queue */}
      <section aria-labelledby="queue-heading" className="flex flex-col gap-4">
        <div>
          <p className="eyebrow">Step 2 · Human Decision</p>
          <h2 id="queue-heading" className="font-serif text-2xl text-heading">
            Invite Requests ({props.requests.length})
          </h2>
        </div>

        <div className="grid gap-4">
          {props.requests.map((r) => (
            <Frame key={r.id} bodyClassName="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-2xl text-heading">
                    {r.name}{" "}
                    {r.instagramHandle ? (
                      <span className="font-sans text-sm font-normal text-accent">@{r.instagramHandle}</span>
                    ) : null}
                  </h3>
                  <p className="mt-1 text-xs text-text-dim">
                    Nights: {r.answers.nights.join(", ") || "None"} · Bringing: {r.answers.bringing ?? "Solo"}
                    {r.vouchCode ? ` · Vouch: ${r.vouchCode}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-rule bg-surface-raised px-3 py-1 font-display text-xs uppercase tracking-wider text-accent">
                  {r.status}
                </span>
              </div>

              {r.aiSummary ? (
                <div className="rounded-xl border border-border bg-bg p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="eyebrow text-[0.65rem]">Goldie Summary ({r.aiSummary.source})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {r.aiSummary.flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full border border-rule px-2 py-0.5 text-[0.65rem] text-accent"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-text">{r.aiSummary.summary}</p>
                </div>
              ) : null}

              {mintedLinks[r.id] ? (
                <div className="rounded-xl border border-rule bg-surface-raised p-4 text-sm flex flex-wrap items-center justify-between gap-3">
                  <span>Coin minted and sent to WhatsApp Outbox! ✨</span>
                  <Link href={mintedLinks[r.id]} className="btn btn-gold text-xs py-2 px-4">
                    Open Minted Coin Link →
                  </Link>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handleReviewRequest(r.id, "approved", 1)}
                  className="btn btn-gold text-xs py-2 px-4 min-h-9"
                >
                  Approve &amp; Send Coin (+1)
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handleReviewRequest(r.id, "approved", 0)}
                  className="btn btn-ghost text-xs py-2 px-4 min-h-9"
                >
                  Approve (Solo)
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handleReviewRequest(r.id, "waitlisted")}
                  className="btn btn-ghost text-xs py-2 px-4 min-h-9"
                >
                  Waitlist
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => handleReviewRequest(r.id, "declined")}
                  className="btn btn-ghost text-xs py-2 px-4 min-h-9"
                >
                  Decline
                </button>
              </div>
            </Frame>
          ))}
        </div>
      </section>

      {/* 2. Coins & Exclusive RSVP Confirmations */}
      <section aria-labelledby="coins-heading" className="flex flex-col gap-4">
        <div>
          <p className="eyebrow">Step 4 · Curated RSVP Review</p>
          <h2 id="coins-heading" className="font-serif text-2xl text-heading">
            Issued Coins &amp; RSVP Confirmations ({props.coins.length})
          </h2>
          <p className="text-sm text-text-dim">
            When a guest claims their coin and submits their details, confirm their RSVP here to unlock their Location
            Drop.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {props.coins.map((c) => (
            <Frame key={c.id} bodyClassName="flex flex-col justify-between gap-4 p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm tracking-widest text-accent">
                    Nº {String(c.serial).padStart(4, "0")} · {c.engraving}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-xs uppercase text-text-dim">
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-text-dim">
                  Guest: {c.guestName ?? "Unclaimed"} ({c.guestPhone ?? c.intendedPhone ?? "—"}) · Plus-ones: +
                  {c.plusOnes}
                </p>

                {c.claimDetails ? (
                  <div className="mt-1 rounded-xl border border-border bg-bg p-3 text-xs">
                    <p className="eyebrow text-[0.65rem]">Submitted RSVP Details</p>
                    <p className="mt-1 text-text">
                      <strong>{c.claimDetails.name}</strong>
                      {c.claimDetails.instagramHandle ? ` (@${c.claimDetails.instagramHandle})` : ""}
                    </p>
                    {c.claimDetails.companionDetails ? (
                      <p className="text-text-dim">Attendance: {c.claimDetails.companionDetails}</p>
                    ) : null}
                    {c.claimDetails.note ? <p className="text-text-dim">Note: &ldquo;{c.claimDetails.note}&rdquo;</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-accent uppercase font-semibold">
                  RSVP: {c.rsvpStatus.replace(/_/g, " ")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {c.rsvpStatus !== "confirmed" ? (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => handleReviewRsvp(c.id, "confirmed")}
                      className="btn btn-gold text-xs py-1.5 px-3 min-h-8"
                    >
                      Confirm RSVP
                    </button>
                  ) : null}
                  {c.rsvpStatus !== "waitlisted" ? (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => handleReviewRsvp(c.id, "waitlisted")}
                      className="btn btn-ghost text-xs py-1.5 px-3 min-h-8"
                    >
                      Waitlist
                    </button>
                  ) : null}
                </div>
              </div>
            </Frame>
          ))}
        </div>
      </section>

      {/* 3. Direct Invite Minting */}
      <section aria-labelledby="direct-heading" className="grid gap-6 lg:grid-cols-2">
        <Frame bodyClassName="flex flex-col gap-4 p-6">
          <div>
            <p className="eyebrow">Direct Invites</p>
            <h2 id="direct-heading" className="mt-1 font-serif text-2xl text-heading">
              Mint a Coin Straight from the Regulars List
            </h2>
          </div>

          <form onSubmit={handleDirectInvite} method="POST" className="flex flex-col gap-4">
            <div>
              <label htmlFor={`${baseId}-dname`} className="block text-xs font-medium text-text mb-1">
                Guest name (required)
              </label>
              <input
                id={`${baseId}-dname`}
                name="name"
                type="text"
                required
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-text"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${baseId}-dphone`} className="block text-xs font-medium text-text mb-1">
                  Mobile number (required)
                </label>
                <input
                  id={`${baseId}-dphone`}
                  name="phone"
                  type="tel"
                  required
                  value={directPhone}
                  onChange={(e) => setDirectPhone(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-text"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-dig`} className="block text-xs font-medium text-text mb-1">
                  Instagram handle
                </label>
                <input
                  id={`${baseId}-dig`}
                  name="instagram"
                  type="text"
                  value={directIg}
                  onChange={(e) => setDirectIg(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-text"
                />
              </div>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-xs font-medium text-text">Allowed companions (+1s)</legend>
              <div className="flex gap-3">
                {[0, 1, 2].map((n) => (
                  <label key={n} className="flex items-center gap-1.5 text-xs text-text cursor-pointer">
                    <input
                      type="radio"
                      name="plusOnes"
                      value={n}
                      checked={directPlusOnes === n}
                      onChange={() => setDirectPlusOnes(n)}
                      className="accent-accent"
                    />
                    <span>{n === 0 ? "Solo" : `+${n}`}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button type="submit" disabled={busyId === "direct"} className="btn btn-gold self-start text-xs">
              {busyId === "direct" ? "Minting..." : "Mint Direct Coin"}
            </button>

            {directResult ? (
              <div className="rounded-xl border border-rule bg-surface-raised p-3 text-xs flex items-center justify-between">
                <span>Minted Coin Nº {String(directResult.serial).padStart(4, "0")}</span>
                <Link href={directResult.coinUrl} className="text-accent underline">
                  {directResult.coinUrl} →
                </Link>
              </div>
            ) : null}
          </form>
        </Frame>

        {/* 4. Outbox Log */}
        <Frame bodyClassName="flex flex-col gap-4 p-6">
          <div>
            <p className="eyebrow">In-App Outbox</p>
            <h2 className="mt-1 font-serif text-2xl text-heading">Recent WhatsApp Messages</h2>
          </div>
          <ul className="flex max-h-80 flex-col gap-2.5 overflow-y-auto pr-1 text-xs">
            {props.outbox.map((m) => (
              <li key={m.id} className="rounded-xl border border-border bg-surface-raised p-3">
                <div className="flex items-center justify-between text-accent-muted">
                  <span className="uppercase tracking-wider">{m.template.replace(/_/g, " ")}</span>
                  <span>{m.toPhone}</span>
                </div>
                <p className="mt-1 text-text">{m.body}</p>
                {m.coinUrl ? (
                  <Link href={m.coinUrl} className="mt-1.5 inline-block text-accent underline">
                    Open {m.coinUrl} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Frame>
      </section>
    </div>
  );
}
