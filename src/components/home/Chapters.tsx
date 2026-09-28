/*
  The six home chapters, as plain server-rendered HTML. Every fact is here in
  the DOM; the 3D coin behind them is decoration. Tall chapters hold their text
  still (sticky) while scroll drives the coin; below the Full and Lite tiers
  they collapse to normal height (see globals.css).
*/
import Image from "next/image";
import Link from "next/link";
import { dateBlock, formatDate, formatTime, zoneLabel } from "@/lib/dates";
import type { PublicNight } from "@/lib/domain/events";
import type { InnercircleTeaser, PastNight } from "@/lib/domain/innercircle";
import { SITE_LINE } from "@/lib/site";
import { themeFor } from "@/themes";
import logo from "../../../public/brand/logo.jpg";
import { DemoTag, Frame } from "../brand/Frame";
import { IonicColumn } from "../brand/IonicColumn";
import { TailsArt } from "../brand/TailsArt";
import { GoldieChat } from "../goldie/GoldieChat";
import { NightArt } from "./NightArt";

/** Text sits on the left on wide screens and under the coin on narrow ones. */
function TextColumn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`chapter-text relative flex max-w-xl flex-col gap-5 wide:max-w-[min(36rem,46vw)] ${className}`}>{children}</div>;
}

// ── 1. The vault ─────────────────────────────────────────────────────────

export function ChapterVault() {
  return (
    <section data-chapter="0" aria-labelledby="ch-vault" className="chapter chapter-tall h-[190svh]">
      <div className="chapter-pin sticky top-0 flex h-svh items-end wide:items-center">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 wide:pb-0">
          <TextColumn className="items-center text-center wide:items-start wide:text-left">
            <p className="eyebrow">Nagpur · Members only</p>
            <h1 id="ch-vault" className="font-display text-[clamp(2.3rem,5.2vw,4.6rem)] leading-[1.02] font-semibold tracking-[0.06em]">
              <span className="diamond-caps">UNDERDOGS</span>
              <span className="glint-star" aria-hidden />
              <br />
              <span className="diamond-caps">INNERCIRCLE</span>
            </h1>
            <p className="max-w-md font-serif text-xl text-text sm:text-2xl">{SITE_LINE}</p>
            <div className="flex flex-wrap justify-center gap-3 wide:justify-start">
              <Link href="/innercircle" className="btn btn-gold">
                Request your coin
              </Link>
              <a href="#ch-drop" className="btn btn-ghost">
                See the next night
              </a>
            </div>
          </TextColumn>
        </div>
        {/* Shown until the 3D coin is on screen, and for good on the No WebGL tier. */}
        <div className="coin-fallback pointer-events-none">
          <Image
            src={logo}
            alt="The Underdogs coin: gold, engraved UNDERDOGS twice around a black onyx face with gold X eyes and a tongue-out smile."
            priority
            sizes="(min-width: 1024px) 30rem, 72vw"
            className="coin-photo h-auto w-full"
          />
          <span className="coin-glint" aria-hidden />
        </div>
      </div>
    </section>
  );
}

// ── 2. Heads or tails ────────────────────────────────────────────────────

export function ChapterHeadsTails() {
  return (
    <section data-chapter="1" data-face="heads" aria-labelledby="ch-heads" className="chapter chapter-tall h-[210svh]">
      <div className="chapter-pin sticky top-0 flex h-svh items-end wide:items-center">
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 wide:pb-0">
          <TextColumn>
            <p className="eyebrow">Heads or tails</p>
            <h2 id="ch-heads" className="font-serif text-3xl leading-tight text-heading sm:text-5xl">
              Heads: the rage. Tails: the room.
            </h2>
            <div className="faces grid gap-4">
              <article className="face-card face-heads rounded-2xl border border-border bg-surface/85 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <Image src={logo} alt="" sizes="3.5rem" className="coin-photo w-14 shrink-0" />
                  <div>
                    <p className="eyebrow">Heads</p>
                    <h3 className="font-serif text-2xl text-heading">Underdogs</h3>
                  </div>
                </div>
                <p className="mt-3 text-text-dim">
                  The rage. Loud, themed, open to all: NYE, Holi and Retro Holi, Diwali, Anti-Valentine, Maison Blanche,
                  Afrochella, Luau, Project X.
                </p>
                <Link href="/nights" className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline">
                  Public nights
                </Link>
              </article>
              <article className="face-card face-tails rounded-2xl border border-border bg-surface/85 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <TailsArt className="w-14 shrink-0" />
                  <div>
                    <p className="eyebrow">Tails</p>
                    <h3 className="font-serif text-2xl text-heading">The Innercircle</h3>
                  </div>
                </div>
                <p className="mt-3 text-text-dim">
                  The room. A smaller circle inside Underdogs, for its selected and most active members. Details stay inside
                  the circle. Invites are personal.
                </p>
                <Link href="/innercircle" className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline">
                  How it works
                </Link>
              </article>
            </div>
          </TextColumn>
        </div>
      </div>
    </section>
  );
}

// ── 3. The drop ──────────────────────────────────────────────────────────

export function ChapterDrop({ next, publicNights }: { next: InnercircleTeaser | null; publicNights: PublicNight[] }) {
  return (
    <section data-chapter="2" aria-labelledby="ch-drop" id="ch-drop" className="chapter scroll-mt-4 py-24 lg:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <TextColumn className="chapter-body">
          <p className="eyebrow">The drop</p>
          <h2 id="ch-drop-title" className="font-serif text-3xl leading-tight text-heading sm:text-5xl">
            The night is set. The address isn&apos;t.
          </h2>
          <p className="text-lg text-text-dim">It drops before doors, to the people holding a coin.</p>

          {next ? <NextNightCard night={next} /> : <p className="text-text-dim">The next night is being set. Watch the circle.</p>}

          {publicNights.length ? (
            <div className="mt-4 flex flex-col gap-3">
              <h3 className="eyebrow">Open to all: Underdogs nights</h3>
              <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface/85 backdrop-blur-sm">
                {publicNights.map((n) => (
                  <li key={n.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                    <Link href={`/nights/${n.slug}`} className="font-serif text-lg text-text hover:text-accent">
                      {n.title}
                    </Link>
                    <span className="text-sm whitespace-nowrap text-text-dim">
                      {formatDate(n.startsAt, n.timezone)}
                      {n.sortmysceneUrl ? (
                        <>
                          {" · "}
                          <a href={n.sortmysceneUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
                            SortMyScene <span aria-hidden>↗</span>
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TextColumn>
      </div>
    </section>
  );
}

function NextNightCard({ night }: { night: InnercircleTeaser }) {
  const b = dateBlock(night.startsAt, night.timezone);
  const world = themeFor(night.theme);
  const rows: [string, string][] = [
    ["When", `${formatDate(night.startsAt, night.timezone)}, ${formatTime(night.startsAt, night.timezone)} ${zoneLabel(night.timezone)}`],
    ["World", world.name],
    ...(night.soundTags.length ? [["Sound", night.soundTags.join(", ")] as [string, string]] : []),
    ...(night.dressCode ? [["Dress code", night.dressCode] as [string, string]] : []),
    ...(night.minAge ? [["Age", `${night.minAge}+`] as [string, string]] : []),
  ];
  return (
    <Frame bodyClassName="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Next in the circle</p>
          <h3 className="mt-2 font-night text-3xl leading-tight text-heading">{night.title}</h3>
          {night.tagline ? <p className="mt-1 text-text-dim">{night.tagline}</p> : null}
        </div>
        <div className="text-right font-display leading-none text-accent" aria-hidden>
          <div className="text-xs tracking-[0.2em] text-accent-muted">{b.weekday}</div>
          <div className="mt-1 text-4xl">{b.day}</div>
          <div className="mt-1 text-xs tracking-[0.2em]">{b.month}</div>
        </div>
      </div>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="eyebrow pt-0.5">{k}</dt>
            <dd className="text-text">{v}</dd>
          </div>
        ))}
        <dt className="eyebrow pt-0.5">Where</dt>
        <dd className="text-text">
          {night.hasDropped ? "Dropped to confirmed guests." : "Location drops before the night."} <span aria-hidden>🔒</span>
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/innercircle" className="btn btn-gold">
          Request your coin
        </Link>
        <Link href={`/innercircle/${night.slug}`} className="btn btn-ghost">
          Night details
        </Link>
        {night.isDemo ? <DemoTag /> : null}
      </div>
    </Frame>
  );
}

// ── 4. Through the circle ────────────────────────────────────────────────

const STEPS: [string, string][] = [
  ["Request", "Your number, your name, the nights you like, who you'd bring."],
  ["Review", "The crew reads every request. People decide."],
  ["Your coin", "Say yes and your personal coin link arrives on WhatsApp."],
  ["Claim & RSVP", "Mint your coin with your details; the Innercircle crew reviews your RSVP personally."],
  ["Location drop", "The exact address drops 72 hours before doors, to confirmed guests only."],
  ["The room", "Step behind the rage into the curated Innercircle night."],
];

export function ChapterCircle() {
  return (
    <section data-chapter="3" aria-labelledby="ch-circle" className="chapter chapter-tall h-[240svh]">
      <div className="chapter-pin sticky top-0 flex h-svh items-end wide:items-center">
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 wide:pb-0">
          <TextColumn>
            <p className="eyebrow">Through the circle</p>
            <h2 id="ch-circle" className="font-serif text-3xl leading-tight text-heading sm:text-5xl">
              Six steps. One coin.
            </h2>
            <ol className="steps grid gap-2 rounded-2xl border border-border bg-surface/85 p-3 backdrop-blur-sm sm:p-4">
              {STEPS.map(([title, body], i) => (
                <li key={title} data-step={i} className="step flex gap-3 rounded-xl p-2">
                  <span className="step-mark font-display mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule text-xs">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-serif text-lg leading-tight text-text">{title}</span>
                    <span className="step-body block text-sm text-text-dim">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </TextColumn>
        </div>
      </div>
    </section>
  );
}

// ── 5. The keeper ────────────────────────────────────────────────────────

export function ChapterKeeper() {
  return (
    <section
      id="concierge"
      data-chapter="4"
      aria-labelledby="ch-keeper"
      className="chapter flex min-h-svh items-end py-24 wide:items-center scroll-mt-12"
    >
      <span id="goldie" className="sr-only" />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <TextColumn className="chapter-body">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Concierge · The Keeper</p>
            <DemoTag />
          </div>
          <h2 id="ch-keeper" className="font-serif text-3xl leading-tight text-heading sm:text-5xl">
            Meet Goldie.
          </h2>
          <p className="text-lg text-text-dim">
            The coin, talking. Ask about upcoming secret nights, dress codes, Nagpur Hinglish, or plus-ones. Goldie gives you the vibe; the crew reviews and opens the door.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-dim">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/60 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Demo mode active
            </span>
            <Link
              href="/concierge"
              className="text-accent underline-offset-4 hover:underline inline-flex items-center gap-1"
            >
              Open dedicated page <span aria-hidden>↗</span>
            </Link>
          </div>
          <GoldieChat />
        </TextColumn>
      </div>
    </section>
  );
}

// ── 6. Been inside ───────────────────────────────────────────────────────

export function ChapterInside({ past }: { past: PastNight[] }) {
  return (
    <section data-chapter="5" aria-labelledby="ch-inside" className="chapter py-24 lg:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="chapter-body flex max-w-2xl flex-col gap-4">
          <p className="eyebrow">Been inside</p>
          <h2 id="ch-inside" className="font-serif text-3xl leading-tight text-heading sm:text-5xl">
            Different worlds. Same coin.
          </h2>
          <p className="text-lg text-text-dim">Every night gets its own world. The coin never changes.</p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 wide:pr-[12%]">
          {past.map((n) => (
            <li key={n.slug} data-stamp className="relative">
              <Frame bodyClassName="flex h-full flex-col overflow-hidden">
                <NightArt posterKey={n.posterKey} theme={n.theme} title={n.title} />
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="eyebrow">
                    {n.kind === "innercircle" ? "Innercircle" : "Underdogs"} · {formatDate(n.startsAt, n.timezone)}
                  </p>
                  <h3 className="font-serif text-2xl leading-tight text-heading">{n.title}</h3>
                  <p className="text-sm text-text-dim">
                    {[n.venueName && [n.venueName, n.venueArea].filter(Boolean).join(", "), n.lineup.length ? n.lineup.join(" and ") : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {n.tagline ? <p className="text-sm text-text-dim">{n.tagline}</p> : null}
                  {n.dressCode ? <p className="text-sm text-text-dim">Dress code: {n.dressCode}</p> : null}
                  {n.partners.length ? <p className="text-sm text-text-dim">With {n.partners.join(", ")}</p> : null}
                  {n.instagramUrl ? (
                    <a href={n.instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-auto pt-2 text-sm text-accent underline-offset-4 hover:underline">
                      See it on Instagram <span aria-hidden>↗</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null}
                </div>
              </Frame>
              <span className="wax-seal" aria-hidden>
                <IonicColumn className="h-6 w-5" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
