import type { Metadata } from "next";
import Link from "next/link";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { IonicColumn } from "@/components/brand/IonicColumn";
import { GoldieChat } from "@/components/goldie/GoldieChat";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Concierge · Goldie",
  description:
    "Ask Goldie about upcoming Underdogs Innercircle nights, dress codes, music vibes, door entry, and invites in Nagpur.",
};

export default function ConciergePage() {
  const isDemo = isDemoMode();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
      {/* Page Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs tracking-wider text-text-dim uppercase transition-colors hover:text-accent"
            >
              ← Back to Vault
            </Link>
            <span className="text-xs text-text-dim/40">/</span>
            <span className="text-xs tracking-wider text-accent uppercase font-medium">Concierge</span>
          </div>
          {isDemo ? <DemoTag /> : null}
        </div>

        <div className="max-w-3xl">
          <p className="eyebrow">Nagpur · AI Concierge</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight text-heading sm:text-6xl">
            Underdogs Concierge.
          </h1>
          <p className="mt-3 text-lg text-text-dim leading-relaxed">
            Meet <span className="text-accent font-medium">Goldie</span> — the AI keeper of Underdogs Innercircle.
            Ask about upcoming secret nights, dress codes, music genres, or Nagpur Hinglish.
            Goldie guides your journey; our human crew reviews requests and opens the door.
          </p>
        </div>
      </header>

      {/* Main Grid: Chatbot on the left/main, Context & Rules on the right */}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
        {/* Chatbot Column */}
        <section aria-labelledby="chat-heading" className="w-full">
          <h2 id="chat-heading" className="sr-only">
            Goldie AI Chat
          </h2>
          <GoldieChat />
        </section>

        {/* Sidebar Info Column */}
        <aside className="flex flex-col gap-5">
          {/* Card: What Goldie Knows */}
          <Frame bodyClassName="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                🪙
              </span>
              <h3 className="font-serif text-xl text-heading">The Keeper&apos;s Voice</h3>
            </div>
            <p className="text-sm text-text-dim leading-relaxed">
              Goldie speaks with exclusivity and a wink. Fluent in English and Nagpur Hinglish.
            </p>
            <ul className="space-y-2.5 text-xs text-text-dim">
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-text">Instant Answers:</strong> Tap any demo chip below the chat for immediate details on the next night, dress codes, or plus-ones.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-text">Secret Venue Gate:</strong> Exact addresses stay locked until 72 hours before doors. Goldie will never leak it early. 🔒
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-text">Door Entry:</strong> Zero ticketing, zero payment gateways. Coins are personal, invite-only, and reviewed by the crew.
                </span>
              </li>
            </ul>
          </Frame>

          {/* Card: 3D Experience Link */}
          <Frame bodyClassName="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>
                ✨
              </span>
              <h3 className="font-serif text-xl text-heading">Interactive 3D Coin</h3>
            </div>
            <p className="text-sm text-text-dim leading-relaxed">
              Experience Goldie on the main stage alongside our bespoke 3D GLB coin that responds to scroll, cursor, and touch.
            </p>
            <div>
              <Link href="/#concierge" className="btn btn-gold text-xs py-2 px-4 inline-flex items-center gap-1.5">
                <span>View with 3D Coin (Chapter 4)</span>
                <span aria-hidden>↗</span>
              </Link>
            </div>
          </Frame>

          {/* Card: Human Crew Handoff */}
          <div className="rounded-2xl border border-border/70 bg-surface/50 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <IonicColumn className="h-4 w-4 text-accent" />
              <h4 className="font-serif text-sm text-text font-medium">Need Human Assistance?</h4>
            </div>
            <p className="text-xs text-text-dim leading-relaxed mb-3">
              Special guest inquiries, brand collaborations, or table requests are handled directly by the Underdogs founding crew.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/crew" className="btn btn-ghost text-xs py-1.5 px-3">
                Crew Console
              </Link>
              <Link href="/innercircle" className="btn btn-ghost text-xs py-1.5 px-3">
                Request Coin
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
