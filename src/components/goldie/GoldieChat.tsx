"use client";
/*
  Goldie, the Underdogs AI Concierge chatbot component.
  Designed for seamless demo presentations: provides instant responses to
  common guest inquiries (next night, dress code, plus-ones, secret location,
  how to get invited) with one-click quick question chips and full English/Hinglish understanding.
*/
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { joinWaitlistAction } from "@/app/actions/innercircle";
import type { GoldieCard, GoldieTurnResult } from "@/lib/goldie";
import logo from "../../../public/brand/logo.jpg";
import { DemoTag } from "../brand/Frame";

const DEMO_CHIPS = [
  { label: "🍸 Next night", text: "What's the next night?" },
  { label: "📍 Secret venue", text: "Where is the party?" },
  { label: "👔 Dress code", text: "What is the dress code?" },
  { label: "🎟️ Plus-ones", text: "Can I bring a friend?" },
  { label: "🗝️ Request invite", text: "Get me in" },
  { label: "🐕 Who are Underdogs?", text: "Who are the Underdogs?" },
] as const;

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  mood?: string;
  cards?: GoldieCard[];
  time?: string;
};

export function GoldieChat({
  context = { mode: "global" },
  className = "",
}: {
  context?: { mode: "global" } | { mode: "event"; slug: string };
  className?: string;
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
      time: "Just now",
    },
  ]);
  const [waitlistMsg, setWaitlistMsg] = useState<string | null>(null);
  const seqRef = useRef(1);
  const inputId = useId();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    const userSeq = seqRef.current++;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatEntry = {
      id: `u-${userSeq}`,
      role: "user",
      text: trimmed,
      time: nowTime,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/goldie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId, context }),
      });
      const data = (await res.json()) as GoldieTurnResult;
      if (data.sessionId) setSessionId(data.sessionId);
      setModeLabel(data.mode);

      const assistantSeq = seqRef.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${assistantSeq}`,
          role: "assistant",
          text: data.reply,
          mood: data.mood,
          cards: data.cards,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      const errSeq = seqRef.current++;
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${errSeq}`,
          role: "assistant",
          text: "Something flickered on my end. Check upcoming nights below or ask again. 🖤",
          mood: "sorry",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setMessages([
      {
        id: "greeting",
        role: "assistant",
        text: "Ask me anything. Except the address. That drops later. 🔒",
        mood: "warm",
        time: "Just now",
      },
    ]);
    setInput("");
    setBusy(false);
  }

  async function handleJoinWaitlist(slug: string) {
    const res = await joinWaitlistAction(slug);
    if (res.ok) {
      setWaitlistMsg("You're on the waitlist. We'll ping you if a spot opens. ✨");
    } else {
      setWaitlistMsg(res.error);
    }
  }

  return (
    <div
      className={`flex flex-col rounded-3xl border border-rule/50 bg-surface/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${className}`}
    >
      {/* Concierge Chat Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Image
              src={logo}
              alt="Goldie Concierge"
              width={40}
              height={40}
              className="rounded-full border border-rule shadow-sm"
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-surface bg-emerald-500"
              title="Online"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg leading-none font-semibold text-heading">Goldie</h3>
              <span className="rounded-full border border-rule/60 bg-surface-raised px-2 py-0.5 text-[0.65rem] tracking-wider text-accent uppercase">
                AI Concierge
              </span>
            </div>
            <p className="mt-1 text-xs text-text-dim">
              Underdogs Nagpur · {modeLabel === "offline" ? "Offline Demo Mode" : "Live Gemini"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-text-dim/80 hover:text-accent transition-colors underline-offset-4 hover:underline cursor-pointer px-2 py-1"
            title="Reset conversation to greeting"
          >
            Reset
          </button>
          <DemoTag />
        </div>
      </div>

      {/* Message Feed */}
      <div
        ref={chatScrollRef}
        role="log"
        aria-live="polite"
        className="flex max-h-[22rem] min-h-[14rem] flex-col gap-4 overflow-y-auto p-4 sm:p-5"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
              {m.role === "assistant" ? (
                <Image
                  src={logo}
                  alt=""
                  width={24}
                  height={24}
                  className="rounded-full border border-rule/60 shrink-0 mb-1"
                />
              ) : null}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-tr-xs bg-gradient-to-r from-amber-600/90 to-yellow-600/90 text-white font-medium shadow-md"
                    : "rounded-tl-xs border border-border/80 bg-surface-raised/95 text-text shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>

            {/* Structured action cards returned by Goldie */}
            {m.cards?.map((card, idx) => (
              <div key={idx} className="w-full max-w-[92%] sm:max-w-[85%] pl-8">
                {card.kind === "night" ? (
                  <div className="rounded-xl border border-rule/80 bg-surface p-4 text-sm shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <span className="eyebrow text-accent">
                        {card.eventKind === "innercircle" ? "Innercircle Night" : "Public Night"}
                      </span>
                      {card.isDemo ? <DemoTag /> : null}
                    </div>
                    <h4 className="mt-1 font-serif text-lg text-heading">{card.title}</h4>
                    <p className="mt-1 text-xs text-text-dim">📅 {card.when}</p>
                    {card.sound.length ? (
                      <p className="mt-1 text-xs text-text-dim">🎵 Sound: {card.sound.join(", ")}</p>
                    ) : null}
                    {card.dressCode ? (
                      <p className="mt-1 text-xs text-text-dim">👔 Dress code: {card.dressCode}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-accent-muted">📍 {card.where}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.eventKind === "innercircle" ? (
                        <Link href={`/innercircle/${card.slug}`} className="btn btn-gold text-xs py-1.5 px-3 min-h-8">
                          Open Night Page
                        </Link>
                      ) : (
                        <Link href={`/nights/${card.slug}`} className="btn btn-ghost text-xs py-1.5 px-3 min-h-8">
                          See Public Night
                        </Link>
                      )}
                      <Link href="/innercircle" className="btn btn-ghost text-xs py-1.5 px-3 min-h-8">
                        Request Coin
                      </Link>
                    </div>
                  </div>
                ) : null}

                {card.kind === "request_form" ? (
                  <div className="rounded-xl border border-rule/80 bg-surface p-4 text-sm shadow-md">
                    <p className="eyebrow text-accent">Invite Request</p>
                    <p className="mt-1 text-xs text-text-dim">
                      Step behind the rage. Verify your number and tell us who you&apos;d bring.
                    </p>
                    <div className="mt-3">
                      <Link href="/innercircle" className="btn btn-gold text-xs py-1.5 px-3 min-h-8">
                        Request Your Coin →
                      </Link>
                    </div>
                  </div>
                ) : null}

                {card.kind === "waitlist_confirm" ? (
                  <div className="rounded-xl border border-rule/80 bg-surface p-4 text-sm shadow-md">
                    <p className="eyebrow text-accent">Waitlist · {card.eventTitle}</p>
                    <p className="mt-1 text-xs text-text-dim">
                      Tap below to hold your spot in the queue.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleJoinWaitlist(card.eventSlug)}
                        className="btn btn-gold text-xs py-1.5 px-3 min-h-8"
                      >
                        Confirm Waitlist Spot
                      </button>
                      {waitlistMsg ? <span className="text-xs text-accent">{waitlistMsg}</span> : null}
                    </div>
                  </div>
                ) : null}

                {card.kind === "status" ? (
                  <div className="rounded-xl border border-rule/80 bg-surface p-4 text-sm shadow-md">
                    <p className="eyebrow text-accent">Your Status</p>
                    <p className="mt-1 font-serif text-base text-heading">{card.summary}</p>
                    <Link href="/me" className="mt-2 inline-block text-xs text-accent underline">
                      Open Your Coin Vault →
                    </Link>
                  </div>
                ) : null}

                {card.kind === "handoff" ? (
                  <div className="rounded-xl border border-rule/80 bg-surface p-4 text-sm shadow-md">
                    <p className="eyebrow text-accent">Crew Handoff</p>
                    <p className="mt-1 text-xs text-text-dim">{card.summary}</p>
                    <a
                      href={card.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 btn btn-ghost text-xs py-1.5 px-3 min-h-8 inline-flex items-center gap-1.5"
                    >
                      <span>💬 Message Crew on WhatsApp</span>
                      <span aria-hidden>↗</span>
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 text-xs text-accent-muted pl-8 animate-pulse">
            <span className="inline-block h-2 w-2 rounded-full bg-accent animate-ping" />
            Goldie is thinking... ✨
          </div>
        ) : null}
      </div>

      {/* Quick Demo Question Chips */}
      <div className="border-t border-border/60 bg-surface-raised/40 px-4 py-2.5">
        <p className="text-[0.68rem] font-medium tracking-wider text-text-dim/80 uppercase mb-1.5">
          Ask Goldie (Click to Demo):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_CHIPS.map((chip) => (
            <button
              key={chip.text}
              type="button"
              disabled={busy}
              onClick={() => sendMessage(chip.text)}
              className="rounded-full border border-border/80 bg-surface/80 px-2.5 py-1 text-xs text-text-dim transition-all hover:border-rule hover:bg-surface hover:text-accent cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="flex items-center gap-2 border-t border-border/80 p-3"
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
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Goldie about nights, dress codes, or Nagpur Hinglish..."
          className="flex-1 rounded-full border border-border bg-bg/80 px-4 py-2 text-sm text-text placeholder:text-text-dim/50 focus:border-rule focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="btn btn-gold text-xs px-4 py-2 rounded-full disabled:opacity-40 min-h-9 font-medium"
        >
          {busy ? "..." : "Send ✨"}
        </button>
      </form>
    </div>
  );
}
