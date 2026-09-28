"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  simulateCancellationAction,
  switchDemoPersona,
  timeTravelAction,
} from "@/app/actions/demo";
import { type TimeTravel } from "@/lib/domain/demo";
import {
  checkInCoinAction,
  issueDirectCoinAction,
  reviewCoinRsvpAction,
  reviewInviteRequestAction,
} from "@/app/actions/innercircle";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { formatDate, formatTime, zoneLabel } from "@/lib/dates";
import type { CoinClaimDetails, CrewSummary, RequestAnswers } from "@/lib/db/schema";

export type RequestItem = {
  id: string;
  name: string;
  instagramHandle: string | null;
  answers: RequestAnswers;
  vouchCode: string | null;
  status: string;
  aiSummary: CrewSummary | null;
  crewNotes: string | null;
  createdAtIso: string;
};

export type CoinItem = {
  id: string;
  serial: number;
  engraving: string;
  plusOnes: number;
  status: string; // "sent" | "claimed" | "used" | "expired" | "revoked"
  rsvpStatus: string; // "not_submitted" | "pending_review" | "confirmed" | "waitlisted" | "declined"
  claimDetails: CoinClaimDetails | null;
  intendedPhone: string | null;
  guestName: string | null;
  guestPhone: string | null;
  claimedAtIso: string | null;
  createdAtIso?: string;
};

export type WaitlistItem = {
  id: string;
  status: string;
  guestName: string | null;
  guestPhone: string | null;
  offeredAtIso: string | null;
  offerExpiresAtIso: string | null;
  createdAtIso: string;
};

export type NightItem = {
  id: string;
  slug: string;
  kind: "innercircle" | "public";
  status: string;
  title: string;
  tagline: string | null;
  theme: string;
  soundTags: string[];
  dressCode: string | null;
  capacity: number;
  confirmedCount: number;
  startsAtIso: string;
  endsAtIso: string;
  timezone: string;
  dropAtIso: string | null;
  dropFiredAtIso: string | null;
  venueName?: string | null;
  venueArea?: string | null;
  venueAddress?: string | null;
  venueMapsUrl?: string | null;
};

export type FaqItem = {
  id: string;
  key: string;
  question: string;
  answer: string;
  sort: number;
  isDemo: boolean;
};

export type OutboxItem = {
  id: string;
  toPhone: string;
  template: string;
  body: string;
  coinUrl?: string;
  createdAtIso?: string;
};

type Props =
  | {
      authorized: false;
      isDemo: boolean;
    }
  | {
      authorized: true;
      nowIso: string;
      actorRole: string;
      actorName: string;
      requests: RequestItem[];
      coins: CoinItem[];
      waitlists: WaitlistItem[];
      nights: NightItem[];
      faqs: FaqItem[];
      outbox: OutboxItem[];
    };

type TabKey = "requests" | "coins" | "direct" | "nights" | "rules" | "outbox";

export function CrewClient(props: Props) {
  const router = useRouter();
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<TabKey>("requests");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mintedLinks, setMintedLinks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filters
  const [requestFilter, setRequestFilter] = useState<"all" | "submitted" | "approved" | "waitlisted" | "declined">(
    "all",
  );
  const [coinFilter, setCoinFilter] = useState<"all" | "confirmed" | "pending_review" | "used">("all");

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
        <p className="text-sm text-text-dim leading-relaxed">
          The review queue, direct coin minting, RSVP confirmations, door check-ins, and venue drops require a Crew or Admin account.
        </p>
        {props.isDemo ? (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-xs text-accent">Demo Mode: Select a test persona to access the console</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await switchDemoPersona("admin");
                  router.refresh();
                }}
                className="btn btn-gold text-xs py-2 px-4"
              >
                Sign in as Crew / Admin (Demo)
              </button>
            </div>
          </div>
        ) : null}
      </Frame>
    );
  }

  // Active Next Night
  const activeNight = props.nights.find((n) => n.kind === "innercircle") ?? props.nights[0];
  const totalCoins = props.coins.length;
  const confirmedCount = props.coins.filter((c) => c.rsvpStatus === "confirmed").length;
  const checkedInCount = props.coins.filter((c) => Boolean(c.claimDetails?.checkedIn)).length;

  const filteredRequests = props.requests.filter((r) => {
    if (requestFilter === "all") return true;
    if (requestFilter === "submitted") return r.status === "submitted" || r.status === "in_review";
    return r.status === requestFilter;
  });

  const filteredCoins = props.coins.filter((c) => {
    if (coinFilter === "all") return true;
    if (coinFilter === "confirmed") return c.rsvpStatus === "confirmed";
    if (coinFilter === "pending_review") return c.rsvpStatus === "pending_review";
    if (coinFilter === "used") return Boolean(c.claimDetails?.checkedIn);
    return true;
  });

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

  async function handleDoorCheckIn(coinId: string, currentlyCheckedIn: boolean) {
    setBusyId(coinId);
    setFeedback(null);
    const res = await checkInCoinAction({ coinId, checkedIn: !currentlyCheckedIn });
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

  async function handleTimeTravel(to: TimeTravel) {
    setBusyId("time");
    setFeedback(null);
    try {
      await timeTravelAction(to);
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Time travel failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSimulateChurn() {
    setBusyId("churn");
    setFeedback(null);
    try {
      const res = await simulateCancellationAction();
      setFeedback(
        res.offeredToGuestName
          ? `Freed spot automatically offered to waitlisted guest: ${res.offeredToGuestName}! Notification sent. ✨`
          : "RSVP cancelled, but no guests were waiting on the waitlist.",
      );
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Churn simulation failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Top Header & Persona Badge ────────────────────────────── */}
      <header className="flex flex-col gap-4 border-b border-border/80 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Underdogs Innercircle</span>
              <span className="rounded-full border border-rule/60 bg-surface-raised px-2.5 py-0.5 text-[0.65rem] tracking-wider text-accent uppercase font-medium">
                Crew Console
              </span>
            </div>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl text-heading font-semibold">
              Curated Night Operations
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-dim">
              Actor: <strong className="text-accent">{props.actorName}</strong> ({props.actorRole})
            </span>
            <DemoTag />
          </div>
        </div>

        {/* Live Operational Status Ribbon */}
        {activeNight ? (
          <div className="rounded-2xl border border-rule/50 bg-surface-raised/60 p-4 sm:p-5 backdrop-blur-md">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
              <div>
                <p className="eyebrow text-[0.68rem]">Active Secret Night</p>
                <p className="mt-0.5 font-serif text-lg text-heading font-medium">{activeNight.title}</p>
                <p className="text-xs text-text-dim">
                  Theme: <span className="text-accent capitalize">{activeNight.theme}</span> · {activeNight.venueArea ?? "Civil Lines"}
                </p>
              </div>

              <div>
                <p className="eyebrow text-[0.68rem]">Confirmed Guestlist</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-display text-xl text-heading">
                    {confirmedCount} <span className="text-xs text-text-dim">/ {activeNight.capacity}</span>
                  </span>
                  <span className="rounded-full bg-surface border border-border px-2 py-0.5 text-[0.68rem] text-accent">
                    {Math.round((confirmedCount / Math.max(1, activeNight.capacity)) * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-bg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((confirmedCount / Math.max(1, activeNight.capacity)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="eyebrow text-[0.68rem]">Door Arrived / Coins</p>
                <p className="mt-0.5 font-display text-lg text-heading">
                  <span className="text-emerald-400 font-bold">{checkedInCount}</span>
                  <span className="text-xs text-text-dim"> Arrived at Door</span>
                </p>
                <p className="text-xs text-text-dim">
                  Total Minted: {totalCoins} · Waitlist: {props.waitlists.length}
                </p>
              </div>

              <div>
                <p className="eyebrow text-[0.68rem]">Venue Location Drop</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      activeNight.dropFiredAtIso ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  <span className="text-xs text-text font-medium">
                    {activeNight.dropFiredAtIso ? "Revealed to Confirmed ✨" : "Sealed (Drops 72h) 🔒"}
                  </span>
                </div>
                <p className="text-[0.7rem] text-text-dim/80 truncate">
                  Venue: {activeNight.venueName ?? "Millo"}
                </p>
              </div>
            </div>

            {/* Demo Controls Fast Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
              <span className="text-[0.7rem] tracking-wider text-accent-muted uppercase font-medium">
                Demo Fast Controls:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busyId === "time"}
                  onClick={() => handleTimeTravel("to_drop")}
                  className="rounded-full border border-border/80 bg-surface px-2.5 py-1 text-text-dim hover:text-accent hover:border-rule transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Jump clock forward to 72 hours before doors"
                >
                  🔒 Jump to Drop (72h)
                </button>
                <button
                  type="button"
                  disabled={busyId === "time"}
                  onClick={() => handleTimeTravel("to_doors")}
                  className="rounded-full border border-border/80 bg-surface px-2.5 py-1 text-text-dim hover:text-accent hover:border-rule transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Jump clock forward to night doors open"
                >
                  🚪 Jump to Doors
                </button>
                <button
                  type="button"
                  disabled={busyId === "time"}
                  onClick={() => handleTimeTravel("plus_hour")}
                  className="rounded-full border border-border/80 bg-surface px-2.5 py-1 text-text-dim hover:text-accent hover:border-rule transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  ⏩ +1 Hour
                </button>
                <button
                  type="button"
                  disabled={busyId === "churn"}
                  onClick={handleSimulateChurn}
                  className="rounded-full border border-border/80 bg-surface px-2.5 py-1 text-accent-muted hover:text-accent hover:border-rule transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Cancels 1 confirmed spot and tests automatic FIFO waitlist promotion"
                >
                  🎲 Simulate Churn
                </button>
                <button
                  type="button"
                  disabled={busyId === "time"}
                  onClick={() => handleTimeTravel("reset")}
                  className="rounded-full border border-border/80 bg-surface px-2.5 py-1 text-text-dim hover:text-accent hover:border-rule transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  🔄 Reset Clock
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* Feedback Alert */}
      {feedback ? (
        <div
          role="alert"
          className="rounded-xl border border-rule/80 bg-surface-raised p-4 text-sm text-accent shadow-md flex items-center justify-between"
        >
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs text-text-dim hover:text-text cursor-pointer ml-4"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* ── Console Tabs Navigation ──────────────────────────────── */}
      <nav aria-label="Crew Console Sections" className="border-b border-border/80 pb-px">
        <ul className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <li>
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === "requests"
                  ? "border-accent text-accent bg-surface-raised"
                  : "border-transparent text-text-dim hover:text-text hover:bg-surface/50"
              }`}
            >
              <span>📥 Review Queue</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-accent-muted">
                {props.requests.length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setActiveTab("coins")}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === "coins"
                  ? "border-accent text-accent bg-surface-raised"
                  : "border-transparent text-text-dim hover:text-text hover:bg-surface/50"
              }`}
            >
              <span>🎟️ Guest List &amp; Door</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-accent-muted">
                {props.coins.length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setActiveTab("direct")}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === "direct"
                  ? "border-accent text-accent bg-surface-raised"
                  : "border-transparent text-text-dim hover:text-text hover:bg-surface/50"
              }`}
            >
              <span>🗝️ Direct Minting</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setActiveTab("nights")}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === "nights"
                  ? "border-accent text-accent bg-surface-raised"
                  : "border-transparent text-text-dim hover:text-text hover:bg-surface/50"
              }`}
            >
              <span>🌙 Nights &amp; Venues</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-accent-muted">
                {props.nights.length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setActiveTab("rules")}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === "rules"
                  ? "border-accent text-accent bg-surface-raised"
                  : "border-transparent text-text-dim hover:text-text hover:bg-surface/50"
              }`}
            >
              <span>📜 House Rules &amp; FAQs</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-accent-muted">
                {props.faqs.length}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setActiveTab("outbox")}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 font-medium transition-colors cursor-pointer border-b-2 ${
                activeTab === "outbox"
                  ? "border-accent text-accent bg-surface-raised"
                  : "border-transparent text-text-dim hover:text-text hover:bg-surface/50"
              }`}
            >
              <span>💬 WhatsApp Outbox</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-accent-muted">
                {props.outbox.length}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── TAB 1: Review Queue ────────────────────────────────────── */}
      {activeTab === "requests" && (
        <section aria-labelledby="queue-heading" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Human Decision Gate · Step 2</p>
              <h2 id="queue-heading" className="font-serif text-2xl text-heading">
                Invite Requests Review ({filteredRequests.length})
              </h2>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(["all", "submitted", "approved", "waitlisted", "declined"] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setRequestFilter(filterKey)}
                  className={`rounded-full px-3 py-1 capitalize transition-colors cursor-pointer ${
                    requestFilter === filterKey
                      ? "bg-accent text-on-accent font-semibold"
                      : "bg-surface border border-border text-text-dim hover:text-text"
                  }`}
                >
                  {filterKey === "submitted" ? "Pending" : filterKey}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {filteredRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim text-sm">
                No requests found matching &ldquo;{requestFilter}&rdquo;.
              </div>
            ) : null}

            {filteredRequests.map((r) => (
              <Frame key={r.id} bodyClassName="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-2xl text-heading font-medium">
                      {r.name}{" "}
                      {r.instagramHandle ? (
                        <span className="font-sans text-sm font-normal text-accent">@{r.instagramHandle}</span>
                      ) : null}
                    </h3>
                    <p className="mt-1 text-xs text-text-dim">
                      Nights preferred: {r.answers.nights.join(", ") || "None"} · Bringing: {r.answers.bringing ?? "Solo"}
                      {r.vouchCode ? ` · Vouch Code: ${r.vouchCode}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-display text-xs uppercase tracking-wider ${
                      r.status === "approved"
                        ? "border-emerald-500/80 bg-emerald-950/40 text-emerald-300"
                        : r.status === "waitlisted"
                          ? "border-amber-500/80 bg-amber-950/40 text-amber-300"
                          : r.status === "declined"
                            ? "border-rose-500/80 bg-rose-950/40 text-rose-300"
                            : "border-rule bg-surface-raised text-accent"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {/* Goldie AI Summary & Flags */}
                {r.aiSummary ? (
                  <div className="rounded-xl border border-border/80 bg-bg/90 p-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="eyebrow text-[0.65rem] text-accent">
                        ✨ Goldie AI Screening ({r.aiSummary.source})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {r.aiSummary.flags.map((flag) => (
                          <span
                            key={flag}
                            className="rounded-full border border-rule/70 bg-surface px-2 py-0.5 text-[0.65rem] text-accent-muted"
                          >
                            {flag.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1.5 text-text leading-relaxed">{r.aiSummary.summary}</p>
                  </div>
                ) : null}

                {/* Minted Link Preview */}
                {mintedLinks[r.id] ? (
                  <div className="rounded-xl border border-rule bg-surface-raised p-4 text-sm flex flex-wrap items-center justify-between gap-3 shadow-md">
                    <span className="text-emerald-300 font-medium">✓ Coin minted &amp; sent to WhatsApp Outbox! ✨</span>
                    <Link href={mintedLinks[r.id]} className="btn btn-gold text-xs py-2 px-4">
                      Open Guest Mint Link →
                    </Link>
                  </div>
                ) : null}

                {/* Review Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleReviewRequest(r.id, "approved", 1)}
                    className="btn btn-gold text-xs py-2 px-4 min-h-9"
                  >
                    {busyId === r.id ? "Processing..." : "Approve & Send Coin (+1)"}
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
      )}

      {/* ── TAB 2: Guest List, RSVPs & Door Check-In ──────────────── */}
      {activeTab === "coins" && (
        <section aria-labelledby="coins-heading" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Curated RSVP &amp; Door Verification · Steps 4 &amp; 6</p>
              <h2 id="coins-heading" className="font-serif text-2xl text-heading">
                Guest List &amp; Live Door Check-In ({filteredCoins.length})
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                Confirm guest RSVPs to unlock their Location Drop; tap Check-In at the door as guests arrive.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(["all", "confirmed", "pending_review", "used"] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setCoinFilter(filterKey)}
                  className={`rounded-full px-3 py-1 capitalize transition-colors cursor-pointer ${
                    coinFilter === filterKey
                      ? "bg-accent text-on-accent font-semibold"
                      : "bg-surface border border-border text-text-dim hover:text-text"
                  }`}
                >
                  {filterKey === "used"
                    ? "Checked In"
                    : filterKey === "pending_review"
                      ? "Pending Review"
                      : filterKey}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {filteredCoins.length === 0 ? (
              <div className="sm:col-span-2 rounded-2xl border border-dashed border-border p-8 text-center text-text-dim text-sm">
                No coin-holders found for &ldquo;{coinFilter}&rdquo;.
              </div>
            ) : null}

            {filteredCoins.map((c) => {
              const isCheckedIn = Boolean(c.claimDetails?.checkedIn);
              return (
                <Frame key={c.id} bodyClassName="flex flex-col justify-between gap-4 p-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm tracking-widest text-accent font-semibold">
                        Nº {String(c.serial).padStart(4, "0")} · {c.engraving}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isCheckedIn ? (
                          <span className="rounded-full bg-emerald-950/70 border border-emerald-500/80 px-2.5 py-0.5 text-[0.68rem] text-emerald-300 font-medium">
                            ✓ Arrived
                          </span>
                        ) : null}
                        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs uppercase text-text-dim">
                          {c.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-text-dim">
                      Guest: <strong className="text-text">{c.guestName ?? "Unclaimed"}</strong> (
                      {c.guestPhone ?? c.intendedPhone ?? "—"}) · Plus-ones: +{c.plusOnes}
                    </p>

                    {c.claimDetails ? (
                      <div className="mt-1 rounded-xl border border-border/80 bg-bg/80 p-3 text-xs">
                        <p className="eyebrow text-[0.65rem] text-accent">Submitted RSVP Claim</p>
                        <p className="mt-1 text-text">
                          <strong>{c.claimDetails.name}</strong>
                          {c.claimDetails.instagramHandle ? ` (@${c.claimDetails.instagramHandle})` : ""}
                        </p>
                        {c.claimDetails.companionDetails ? (
                          <p className="text-text-dim mt-0.5">Companion: {c.claimDetails.companionDetails}</p>
                        ) : null}
                        {c.claimDetails.note ? (
                          <p className="text-text-dim mt-0.5">Note: &ldquo;{c.claimDetails.note}&rdquo;</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-1 text-[0.7rem] text-text-dim/60 italic">
                        Coin link sent; waiting for guest to claim &amp; RSVP.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5 border-t border-border pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-xs text-accent uppercase font-semibold">
                        RSVP: {c.rsvpStatus.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-1.5">
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

                    {/* Live Door Check-in Button */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                      <span className="text-[0.7rem] text-text-dim">Door Entry:</span>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => handleDoorCheckIn(c.id, isCheckedIn)}
                        className={`text-xs py-1.5 px-3 rounded-full font-medium transition-all cursor-pointer ${
                          isCheckedIn
                            ? "bg-emerald-600/90 text-white hover:bg-emerald-700"
                            : "btn btn-ghost border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40"
                        }`}
                      >
                        {isCheckedIn ? "✓ Arrived (Click to Undo)" : "Mark Arrived at Door ✓"}
                      </button>
                    </div>
                  </div>
                </Frame>
              );
            })}
          </div>
        </section>
      )}

      {/* ── TAB 3: Direct Coin Minting ────────────────────────────── */}
      {activeTab === "direct" && (
        <section aria-labelledby="direct-heading" className="grid gap-6 lg:grid-cols-2">
          <Frame bodyClassName="flex flex-col gap-4 p-6">
            <div>
              <p className="eyebrow">Direct Invites</p>
              <h2 id="direct-heading" className="mt-1 font-serif text-2xl text-heading">
                Mint a Coin Directly for Regulars
              </h2>
              <p className="text-xs text-text-dim mt-1">
                Skip the request queue for verified regulars. Mints a bespoke coin token and logs the personal invite to the WhatsApp outbox.
              </p>
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
                    Instagram handle (optional)
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
                <div className="flex gap-4">
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
                      <span>{n === 0 ? "Solo" : `+${n} Companion${n > 1 ? "s" : ""}`}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button type="submit" disabled={busyId === "direct"} className="btn btn-gold self-start text-xs py-2 px-5">
                {busyId === "direct" ? "Minting..." : "Mint Direct Coin ✨"}
              </button>

              {directResult ? (
                <div className="rounded-xl border border-rule bg-surface-raised p-4 text-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-accent text-sm font-semibold">
                      Minted Coin Nº {String(directResult.serial).padStart(4, "0")}
                    </span>
                    <span className="text-emerald-400">✓ Sent to Outbox</span>
                  </div>
                  <Link href={directResult.coinUrl} className="text-accent underline break-all">
                    {directResult.coinUrl} →
                  </Link>
                </div>
              ) : null}
            </form>
          </Frame>

          {/* Side Info */}
          <div className="flex flex-col gap-4">
            <Frame bodyClassName="flex flex-col gap-3 p-6">
              <h3 className="font-serif text-lg text-heading">Direct Minting Policy</h3>
              <p className="text-xs text-text-dim leading-relaxed">
                Direct coins bypass the review queue. When minted:
              </p>
              <ul className="space-y-2 text-xs text-text-dim">
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>A secure 32-byte cryptographic token hash is created.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>The coin is engraved with the guest&apos;s clean capitalized name.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>A simulated WhatsApp dispatch is delivered to the Outbox.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">•</span>
                  <span>On first open, the guest verifies their phone OTP and claims their coin.</span>
                </li>
              </ul>
            </Frame>
          </div>
        </section>
      )}

      {/* ── TAB 4: Nights & Venues Manager ────────────────────────── */}
      {activeTab === "nights" && (
        <section aria-labelledby="nights-heading" className="flex flex-col gap-6">
          <div>
            <p className="eyebrow">Night Curation &amp; Secret Venue Gates</p>
            <h2 id="nights-heading" className="font-serif text-2xl text-heading">
              Curated Nights &amp; Venues Manager ({props.nights.length})
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Manage capacity, theme worlds, and timed location drop triggers for both Innercircle and public nights.
            </p>
          </div>

          <div className="grid gap-6">
            {props.nights.map((n) => {
              const startDate = new Date(n.startsAtIso);
              const dropDate = n.dropAtIso ? new Date(n.dropAtIso) : null;
              const hasDropped = Boolean(n.dropFiredAtIso);

              return (
                <Frame key={n.id} bodyClassName="flex flex-col gap-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[0.65rem] tracking-wider uppercase font-medium ${
                            n.kind === "innercircle"
                              ? "border border-rule bg-surface-raised text-accent"
                              : "border border-border bg-surface text-text-dim"
                          }`}
                        >
                          {n.kind === "innercircle" ? "Innercircle (Secret)" : "Public Underdogs"}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-text-dim uppercase">
                          Theme: {n.theme}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-emerald-400 capitalize">
                          {n.status}
                        </span>
                      </div>
                      <h3 className="mt-2 font-serif text-3xl text-heading font-medium">{n.title}</h3>
                      {n.tagline ? <p className="text-xs text-text-dim mt-0.5">{n.tagline}</p> : null}
                    </div>

                    <div className="text-right">
                      <p className="font-display text-lg text-accent">
                        {formatDate(startDate, n.timezone)}
                      </p>
                      <p className="text-xs text-text-dim">
                        {formatTime(startDate, n.timezone)} {zoneLabel(n.timezone)}
                      </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border border-border/80 bg-bg/60 p-4 text-xs">
                    {/* Capacity */}
                    <div>
                      <p className="eyebrow text-[0.65rem]">Capacity &amp; Confirmed</p>
                      <p className="mt-1 font-display text-base text-text">
                        {n.confirmedCount} <span className="text-text-dim text-xs">/ {n.capacity} confirmed</span>
                      </p>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{
                            width: `${Math.min(100, Math.round((n.confirmedCount / Math.max(1, n.capacity)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Secret Venue */}
                    <div>
                      <p className="eyebrow text-[0.65rem]">Secret Venue Details</p>
                      <p className="mt-1 text-text font-medium">{n.venueName ?? "Millo"}</p>
                      <p className="text-text-dim text-[0.7rem] truncate">{n.venueAddress ?? "Plot 12, VIP Road, Civil Lines"}</p>
                      {n.venueMapsUrl ? (
                        <a
                          href={n.venueMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-accent underline inline-flex items-center gap-1"
                        >
                          Google Maps Link ↗
                        </a>
                      ) : null}
                    </div>

                    {/* Location Drop Status */}
                    <div>
                      <p className="eyebrow text-[0.65rem]">Timed Location Drop</p>
                      <p className="mt-1 text-text">
                        {dropDate ? `${formatDate(dropDate, n.timezone)}, ${formatTime(dropDate, n.timezone)}` : "TBA"}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.68rem] font-medium ${
                            hasDropped
                              ? "bg-emerald-950/70 border border-emerald-500/80 text-emerald-300"
                              : "bg-surface border border-border text-amber-300"
                          }`}
                        >
                          {hasDropped ? "✨ Drop Fired" : "🔒 Sealed until 72h"}
                        </span>
                        {!hasDropped && n.kind === "innercircle" ? (
                          <button
                            type="button"
                            disabled={busyId === "time"}
                            onClick={() => handleTimeTravel("to_drop")}
                            className="text-xs text-accent underline cursor-pointer"
                          >
                            Trigger Drop ⚡
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                    <span className="text-text-dim">
                      Sound: {n.soundTags.join(", ") || "Electronic, House"} · Dress code: {n.dressCode ?? "Curated"}
                    </span>
                    <Link
                      href={n.kind === "innercircle" ? `/innercircle/${n.slug}` : `/nights/${n.slug}`}
                      className="btn btn-ghost text-xs py-1.5 px-3"
                    >
                      View Live Night Page ↗
                    </Link>
                  </div>
                </Frame>
              );
            })}
          </div>
        </section>
      )}

      {/* ── TAB 5: House Rules & AI FAQs ──────────────────────────── */}
      {activeTab === "rules" && (
        <section aria-labelledby="rules-heading" className="flex flex-col gap-6">
          <div>
            <p className="eyebrow">Innercircle Knowledge Base</p>
            <h2 id="rules-heading" className="font-serif text-2xl text-heading">
              House Rules &amp; Goldie FAQs ({props.faqs.length})
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              These official rules are consulted by Goldie to respond to questions about dress codes, plus-ones, venues, and policies.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {props.faqs.map((f) => (
              <Frame key={f.id} bodyClassName="flex flex-col justify-between gap-3 p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-rule/60 bg-surface-raised px-2.5 py-0.5 text-[0.65rem] tracking-wider text-accent uppercase font-medium">
                      Rule: {f.key}
                    </span>
                    <span className="text-xs text-text-dim">Sort: #{f.sort}</span>
                  </div>
                  <h3 className="mt-2 font-serif text-lg text-heading font-medium">{f.question}</h3>
                  <p className="mt-1 text-xs text-text leading-relaxed bg-bg/60 p-3 rounded-xl border border-border/60">
                    &ldquo;{f.answer}&rdquo;
                  </p>
                </div>

                <div className="border-t border-border/50 pt-2 flex items-center justify-between text-[0.7rem] text-text-dim">
                  <span>Consulted by Goldie AI</span>
                  <span className="text-emerald-400">✓ Enforced by Crew</span>
                </div>
              </Frame>
            ))}
          </div>
        </section>
      )}

      {/* ── TAB 6: WhatsApp Outbox ─────────────────────────────────── */}
      {activeTab === "outbox" && (
        <section aria-labelledby="outbox-heading" className="flex flex-col gap-6">
          <div>
            <p className="eyebrow">Simulated Notification Dispatch</p>
            <h2 id="outbox-heading" className="font-serif text-2xl text-heading">
              In-App WhatsApp Outbox ({props.outbox.length})
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Audit log of all outbound messages (invites, coin links, location drops, and waitlist offers) delivered to guests.
            </p>
          </div>

          <div className="grid gap-3">
            {props.outbox.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-text-dim text-sm">
                No outbound messages sent yet.
              </div>
            ) : null}

            {props.outbox.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border/80 bg-surface-raised/70 p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-950/70 border border-emerald-500/80 px-2 py-0.5 text-[0.65rem] text-emerald-300 uppercase font-medium">
                      WhatsApp
                    </span>
                    <span className="text-accent uppercase tracking-wider font-semibold text-[0.7rem]">
                      {m.template.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="font-mono text-text-dim">{m.toPhone}</span>
                </div>

                <p className="text-sm text-text leading-relaxed">{m.body}</p>

                {m.coinUrl ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={m.coinUrl}
                      className="btn btn-gold text-xs py-1.5 px-3 min-h-8 inline-flex items-center gap-1.5"
                    >
                      <span>Open Guest Coin Link</span>
                      <span aria-hidden>↗</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
