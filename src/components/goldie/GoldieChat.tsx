"use client";
/*
  Goldie, the talking coin concierge UI.
  Drives the 3D coin's presence state machine in `useStage` (listening, thinking,
  speaking, celebrating, hushed, sorry, idle) and renders structured cards
  (night cards, inline invite request form card, waitlist confirmation card,
  status card, and crew WhatsApp handoff).
*/
import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { joinWaitlistAction } from "@/app/actions/innercircle";
import type { GoldieCard, GoldieTurnResult } from "@/lib/goldie";
import { useStage, type GoldieMood } from "@/three/store";
import logo from "../../../public/brand/logo.jpg";
import { DemoTag, Frame } from "../brand/Frame";

const CHIPS = [
  "What's the next night?",
  "Where is it?",
  "Can I bring a friend?",
  "Get me in",
] as const;

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  mood?: GoldieMood;
  cards?: GoldieCard[];
};

const MOOD_BADGE: Record<GoldieMood, string> = {
  warm: "Warm",
  hype: "Hype ✨",
  hushed: "Hushed 🔒",
  sorry: "Velvet rope",
  celebrate: "Celebrate 🥂",
};

export function GoldieChat({
  context = { mode: "global" },
}: {
  context?: { mode: "global" } | { mode: "event"; slug: string };
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [modeLabel, setModeLabel] = useState<"online" | "offline">("offline");
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: "greeting",
      role: "assistant",
      text: "Ask me anything. Except the address. That drops later. 🔒",
      mood: "warm",
    },
  ]);
  const [waitlistMsg, setWaitlistMsg] = useState<string | null>(null);
  const seqRef = useRef(1);
  const inputId = useId();
  const goldieState = useStage((s) => s.goldieState);
  const setGoldieState = useStage((s) => s.setGoldieState);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    const userSeq = seqRef.current++;
    const userMsg: ChatEntry = { id: `u-${userSeq}`, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setGoldieState("thinking");

    try {
      const res = await fetch("/api/goldie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId, context }),
      });
      const data = (await res.json()) as GoldieTurnResult;
      if (data.sessionId) setSessionId(data.sessionId);
      setModeLabel(data.mode);

      // Animate speaking state briefly, then settle into mood expression
      setGoldieState("speaking", data.mood);
      const assistantSeq = seqRef.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${assistantSeq}`,
          role: "assistant",
          text: data.reply,
          mood: data.mood,
          cards: data.cards,
        },
      ]);

      window.setTimeout(() => {
        if (data.mood === "hushed") setGoldieState("hushed", "hushed");
        else if (data.mood === "celebrate") setGoldieState("celebrating", "celebrate");
        else if (data.mood === "sorry") setGoldieState("sorry", "sorry");
        else setGoldieState("idle", data.mood);
      }, 900);
    } catch {
      setGoldieState("sorry", "sorry");
      const errSeq = seqRef.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${errSeq}`,
          role: "assistant",
          text: "Something flickered on my end. Try again or message the crew on WhatsApp. 🖤",
          mood: "sorry",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinWaitlist(slug: string) {
    const res = await joinWaitlistAction(slug);
    if (res.ok) {
      setGoldieState("celebrating", "celebrate");
      setWaitlistMsg("You're on the waitlist. We'll ping you if a spot opens. ✨");
    } else {
      setWaitlistMsg(res.error);
    }
  }

  return (
    <Frame bodyClassName="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <Image src={logo} alt="" sizes="2.5rem" className="coin-photo w-10 shrink-0" />
          <div>
            <p className="font-serif text-lg leading-tight text-heading">Goldie · The Keeper</p>
            <p className="text-xs text-text-dim">
              Presence: <span className="text-accent uppercase">{goldieState}</span> ·{" "}
              {modeLabel === "offline" ? "Offline mode" : "Live model"}
            </p>
          </div>
        </div>
        <DemoTag />
      </div>

      {/* Conversation history announced politely once each turn completes */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-tr-sm bg-accent text-on-accent font-medium"
                  : "rounded-tl-sm bg-surface-raised text-text border border-border"
              }`}
            >
              {m.mood && m.role === "assistant" ? (
                <span className="mb-1 block font-display text-[0.65rem] tracking-widest text-accent-muted uppercase">
                  {MOOD_BADGE[m.mood]}
                </span>
              ) : null}
              <p>{m.text}</p>
            </div>

            {m.cards?.map((card, idx) => (
              <div key={idx} className="w-full max-w-[92%]">
                {card.kind === "night" ? (
                  <div className="rounded-xl border border-rule bg-surface p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="eyebrow">
                        {card.eventKind === "innercircle" ? "Innercircle Night" : "Public Night"}
                      </span>
                      {card.isDemo ? <DemoTag /> : null}
                    </div>
                    <h4 className="mt-1 font-serif text-xl text-heading">{card.title}</h4>
                    <p className="mt-1 text-xs text-text-dim">{card.when}</p>
                    {card.sound.length ? (
                      <p className="mt-1 text-xs text-text-dim">Sound: {card.sound.join(", ")}</p>
                    ) : null}
                    {card.dressCode ? (
                      <p className="mt-1 text-xs text-text-dim">Dress code: {card.dressCode}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-accent">{card.where}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.eventKind === "innercircle" ? (
                        <Link href={`/innercircle/${card.slug}`} className="btn btn-gold text-xs py-1.5 px-3 min-h-9">
                          Open night page
                        </Link>
                      ) : (
                        <Link href={`/nights/${card.slug}`} className="btn btn-ghost text-xs py-1.5 px-3 min-h-9">
                          See public night
                        </Link>
                      )}
                      {card.mapsUrl ? (
                        <a
                          href={card.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost text-xs py-1.5 px-3 min-h-9"
                        >
                          Google Maps ↗
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {card.kind === "request_form" ? (
                  <div className="rounded-xl border border-rule bg-surface p-4 text-sm">
                    <p className="eyebrow">Draft Invite Request</p>
                    <p className="mt-1 text-text-dim">
                      Step through the velvet rope: verify your number and share your details for the crew.
                    </p>
                    <div className="mt-3">
                      <Link href="/innercircle#request-form" className="btn btn-gold text-xs py-2 px-4 min-h-9">
                        Complete &amp; Submit Request
                      </Link>
                    </div>
                  </div>
                ) : null}

                {card.kind === "waitlist_confirm" ? (
                  <div className="rounded-xl border border-rule bg-surface p-4 text-sm">
                    <p className="eyebrow">Waitlist · {card.eventTitle}</p>
                    <p className="mt-1 text-text-dim">
                      Confirm with your own tap to join the waitlist queue.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleJoinWaitlist(card.eventSlug)}
                        className="btn btn-gold text-xs py-1.5 px-3 min-h-9"
                      >
                        Confirm waitlist spot
                      </button>
                      {waitlistMsg ? <span className="text-xs text-accent">{waitlistMsg}</span> : null}
                    </div>
                  </div>
                ) : null}

                {card.kind === "status" ? (
                  <div className="rounded-xl border border-rule bg-surface p-4 text-sm">
                    <p className="eyebrow">Your Status</p>
                    <p className="mt-1 font-serif text-lg text-heading">{card.summary}</p>
                    <Link href="/me" className="mt-2 inline-block text-xs text-accent underline">
                      Open Your Coin vault →
                    </Link>
                  </div>
                ) : null}

                {card.kind === "handoff" ? (
                  <div className="rounded-xl border border-rule bg-surface p-4 text-sm">
                    <p className="eyebrow">Crew Handoff</p>
                    <p className="mt-1 text-xs text-text-dim">{card.summary}</p>
                    <a
                      href={card.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 btn btn-ghost text-xs py-1.5 px-3 min-h-9"
                    >
                      Message Crew on WhatsApp ↗
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Quick question chips */}
      <ul className="flex flex-wrap gap-2" aria-label="Quick questions">
        {CHIPS.map((c) => (
          <li key={c}>
            <button
              type="button"
              disabled={busy}
              onClick={() => sendMessage(c)}
              className="chip transition-colors hover:border-rule hover:text-accent cursor-pointer"
            >
              {c}
            </button>
          </li>
        ))}
      </ul>

      {/* Input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask Goldie a question
        </label>
        <input
          id={inputId}
          name="message"
          type="text"
          maxLength={1000}
          value={input}
          onFocus={() => setGoldieState("listening")}
          onBlur={() => {
            if (goldieState === "listening") setGoldieState("idle");
          }}
          onChange={(e) => {
            setInput(e.target.value);
            if (goldieState !== "listening") setGoldieState("listening");
          }}
          placeholder="Ask about the next night, dress code, or Hinglish..."
          className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-dim/60 focus:border-rule"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-gold px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Thinking..." : "Ask Goldie"}
        </button>
      </form>
    </Frame>
  );
}
