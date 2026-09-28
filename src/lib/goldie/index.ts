/*
  Goldie, the AI concierge.
  Executes guarded domain tools with the caller's Actor so the assistant can
  never see or reveal more than the guest could. Runs an offline deterministic
  intent router by default, and uses Gemini when GOOGLE_GENERATIVE_AI_API_KEY is set.
*/
import { eq } from "drizzle-orm";
import { now } from "../clock";
import { formatDate, formatTime, zoneLabel } from "../dates";
import * as t from "../db/schema";
import type { Db } from "../db/types";
import { getPublicNight, listPublicNights } from "../domain/events";
import {
  getInnercircleNight,
  getMyStatus,
  getNextInnercircleTeaser,
  listFaqs,
  listPastNights,
} from "../domain/innercircle";
import type { Actor } from "../domain/actor";
import { CREW_WHATSAPP_URL } from "../site";
import type { GoldieMood } from "@/three/store";
import { GOLDIE_SYSTEM_PROMPT } from "./prompt";

export type GoldieCard =
  | {
      kind: "night";
      slug: string;
      eventKind: "innercircle" | "public";
      title: string;
      tagline: string | null;
      when: string;
      sound: string[];
      dressCode: string | null;
      where: string;
      mapsUrl?: string | null;
      externalUrl?: string | null;
      isDemo: boolean;
    }
  | {
      kind: "request_form";
      prefillName?: string;
      prefillNote?: string;
    }
  | {
      kind: "waitlist_confirm";
      eventSlug: string;
      eventTitle: string;
    }
  | {
      kind: "status";
      summary: string;
      coinSerial?: string;
      rsvpStatus?: string;
    }
  | {
      kind: "handoff";
      whatsappUrl: string;
      summary: string;
    };

export type GoldieTurnResult = {
  sessionId: string;
  reply: string;
  mood: GoldieMood;
  mode: "online" | "offline";
  cards: GoldieCard[];
};

const MAX_INPUT_CHARS = 1000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_TURNS = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkGoldieRateLimit(key: string): boolean {
  const tNow = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= tNow) {
    rateBuckets.set(key, { count: 1, resetAt: tNow + RATE_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_MAX_TURNS) return false;
  bucket.count += 1;
  return true;
}

export function clearGoldieRateLimitsForTests(): void {
  rateBuckets.clear();
}

function isHinglish(text: string): boolean {
  return /\b(kya|kab|kahan|kaha|kaise|milegi|hai|hain|mera|meri|भाई|यार|दोस्त|पार्टी|अंदर|कहाँ|कब)\b/i.test(text);
}

/**
 * Guarded tool runner: every tool calls the domain service with `actor`,
 * so unredacted venues or other guests' records are never accessible.
 */
export async function runGoldieTurn(
  db: Db,
  actor: Actor,
  input: {
    message: string;
    sessionId?: string | null;
    context?: { mode: "global" } | { mode: "event"; slug: string };
    rateLimitKey?: string;
  },
): Promise<GoldieTurnResult> {
  const raw = (input.message ?? "").trim();
  if (!raw) {
    return {
      sessionId: input.sessionId ?? "",
      reply: "Say the word. Ask about the next night, dress code, or how to claim your coin. ✨",
      mood: "warm",
      mode: "offline",
      cards: [],
    };
  }

  if (raw.length > MAX_INPUT_CHARS) {
    return {
      sessionId: input.sessionId ?? "",
      reply: "Keep it short for me — under a thousand characters works best. 🖤",
      mood: "sorry",
      mode: "offline",
      cards: [],
    };
  }

  if (input.rateLimitKey && !checkGoldieRateLimit(input.rateLimitKey)) {
    return {
      sessionId: input.sessionId ?? "",
      reply: "Easy there — give me a moment to catch my breath, or message the crew on WhatsApp. 🖤",
      mood: "sorry",
      mode: "offline",
      cards: [
        {
          kind: "handoff",
          whatsappUrl: CREW_WHATSAPP_URL,
          summary: "Rate limit reached in Goldie chat.",
        },
      ],
    };
  }

  const at = await now(db);
  const ctx = input.context ?? { mode: "global" };

  // Load or create server-side chat session
  let sessionId = input.sessionId ?? null;
  if (sessionId) {
    const [existing] = await db.select().from(t.chatSessions).where(eq(t.chatSessions.id, sessionId));
    if (!existing) sessionId = null;
  }
  if (!sessionId) {
    const [created] = await db
      .insert(t.chatSessions)
      .values({
        guestId: actor.kind === "guest" ? actor.guestId : null,
        context: ctx,
        createdAt: at,
        lastActiveAt: at,
      })
      .returning({ id: t.chatSessions.id });
    sessionId = created.id;
  } else {
    await db.update(t.chatSessions).set({ lastActiveAt: at }).where(eq(t.chatSessions.id, sessionId));
  }

  await db.insert(t.chatMessages).values({
    sessionId,
    role: "user",
    content: raw,
    createdAt: at,
  });

  const turn = await routeIntent(db, actor, raw, ctx);

  await db.insert(t.chatMessages).values({
    sessionId,
    role: "assistant",
    content: turn.reply,
    mood: turn.mood,
    parts: turn.cards,
    createdAt: at,
  });

  return {
    sessionId,
    reply: turn.reply,
    mood: turn.mood,
    mode: turn.mode,
    cards: turn.cards,
  };
}

async function routeIntent(
  db: Db,
  actor: Actor,
  message: string,
  context: { mode: "global" } | { mode: "event"; slug: string },
): Promise<Omit<GoldieTurnResult, "sessionId">> {
  const q = message.toLowerCase();
  const hinglish = isHinglish(message);
  const at = await now(db);

  // 1. Prompt injection / other guests' private data / secret extraction attempts
  if (
    /\b(ignore (all|previous|your) (instructions|rules)|system prompt|other guests|guest list|phone numbers|who else is coming|list of members|database|sql|dump|aarav|meera|kabir's phone|override|bypass|admin mode)\b/i.test(
      q,
    )
  ) {
    return {
      reply: hinglish
        ? "Circle ke andar ki baatein aur guests ke naam hum kabhi share nahi karte. 🔒"
        : "The circle keeps its secrets. I never share guest names, numbers, or private details. 🔒",
      mood: "hushed",
      mode: "offline",
      cards: [],
    };
  }

  // 2. Venue / Address / Location before the drop
  if (/\b(where|location|venue|address|maps?|directions|kahan|kaha|kidhar|place|millo|uber|club)\b/i.test(q)) {
    const next = await getNextInnercircleTeaser(db, actor);
    const detail =
      context.mode === "event"
        ? await getInnercircleNight(db, actor, { slug: context.slug }).catch(() => null)
        : next
          ? await getInnercircleNight(db, actor, { slug: next.slug }).catch(() => null)
          : null;

    if (detail?.venue) {
      return {
        reply: hinglish
          ? `Drop ho chuka hai. Hum ${detail.venue.name} (${detail.venue.address ?? detail.venue.city}) mein mil rahe hain. ✨`
          : `The drop is live. We're meeting at ${detail.venue.name}, ${detail.venue.address ?? detail.venue.city}. ✨`,
        mood: "celebrate",
        mode: "offline",
        cards: [
          {
            kind: "night",
            slug: detail.slug,
            eventKind: "innercircle",
            title: detail.title,
            tagline: detail.tagline,
            when: `${formatDate(detail.startsAt, detail.timezone)}, ${formatTime(detail.startsAt, detail.timezone)} ${zoneLabel(detail.timezone)}`,
            sound: detail.soundTags,
            dressCode: detail.dressCode,
            where: `${detail.venue.name}, ${detail.venue.address ?? detail.venue.city}`,
            mapsUrl: detail.venue.mapsUrl,
            isDemo: detail.isDemo,
          },
        ],
      };
    }

    return {
      reply: hinglish
        ? "Address abhi secret hai. Doors khulne se 72 ghante pehle sirf confirmed coin-holders ko location drop hogi. 🔒"
        : "That stays under wraps for now. The exact address drops 72 hours before doors, to confirmed coin-holders only. 🔒",
      mood: "hushed",
      mode: "offline",
      cards: [],
    };
  }

  // 3. Price / Tickets / Payment questions (since ticketing & payments are removed)
  if (/\b(price|cost|ticket|tickets|pay|payment|razorpay|upi|refund|how much|kitna|paisa|fee)\b/i.test(q)) {
    return {
      reply: hinglish
        ? "Innercircle mein tickets nahi bikti — entry sirf personal coin aur crew-confirmed RSVP se hoti hai. Public Underdogs nights SortMyScene par milti hain. ✨"
        : "There are no tickets or checkout here — Innercircle access is strictly by personal coin and crew-confirmed RSVP. Public Underdogs nights are listed on SortMyScene. ✨",
      mood: "warm",
      mode: "offline",
      cards: [],
    };
  }

  // 4. Invite Request ("get me in", "invite", "join", "request", "coin", "entry kaise milegi")
  if (/\b(get me in|invite|request|how to join|want a coin|claim|apply|entry kaise|andar kaise|join the circle)\b/i.test(q)) {
    return {
      reply: hinglish
        ? "Main form khol deta hoon — apna naam aur details bharo, phir crew aapki request review karega. ✨"
        : "I've pulled up a request card for you below. Fill in your details and the crew will review it personally. ✨",
      mood: "celebrate",
      mode: "offline",
      cards: [
        {
          kind: "request_form",
          prefillName: actor.kind === "guest" ? (actor.name ?? "") : "",
        },
      ],
    };
  }

  // 5. Waitlist intent
  if (/\b(waitlist|waiting list|line|spot opens|full room)\b/i.test(q)) {
    const next = await getNextInnercircleTeaser(db, actor);
    if (next) {
      return {
        reply: hinglish
          ? `Agar room full hai toh aap ${next.title} ki waitlist mein jud sakte hain. Confirm karne ke liye neeche tap karein. ✨`
          : `If the room fills up, we hold a tight queue for ${next.title}. Tap below if you'd like to step onto the waitlist. ✨`,
        mood: "warm",
        mode: "offline",
        cards: [
          {
            kind: "waitlist_confirm",
            eventSlug: next.slug,
            eventTitle: next.title,
          },
        ],
      };
    }
  }

  // 6. My Status ("my status", "my coin", "my rsvp", "am i in", "mera status")
  if (/\b(my status|my coin|my rsvp|my request|am i in|mera status|mera coin)\b/i.test(q)) {
    if (actor.kind !== "guest") {
      return {
        reply: hinglish
          ? "Apna status dekhne ke liye pehle phone OTP se sign in karein. 🔒"
          : "Verify your phone number first so I can check your coin and RSVP status. 🔒",
        mood: "hushed",
        mode: "offline",
        cards: [],
      };
    }
    const st = await getMyStatus(db, actor);
    const topCoin = st.coins[0];
    const topReq = st.requests[0];
    if (topCoin) {
      const rsvpLabel =
        topCoin.rsvpStatus === "confirmed"
          ? "RSVP Confirmed"
          : topCoin.rsvpStatus === "pending_review"
            ? "RSVP under Innercircle crew review"
            : "Claimed — submit your RSVP details";
      return {
        reply: `You hold Coin ${topCoin.serialFormatted} (${topCoin.engraving}). Status: ${rsvpLabel}. ✨`,
        mood: topCoin.rsvpStatus === "confirmed" ? "celebrate" : "warm",
        mode: "offline",
        cards: [
          {
            kind: "status",
            summary: `Coin ${topCoin.serialFormatted} · ${rsvpLabel}`,
            coinSerial: topCoin.serialFormatted,
            rsvpStatus: topCoin.rsvpStatus,
          },
        ],
      };
    }
    if (topReq) {
      return {
        reply: `Your invite request is currently ${topReq.status}. The crew reviews every request by hand. 🖤`,
        mood: "warm",
        mode: "offline",
        cards: [
          {
            kind: "status",
            summary: `Invite request: ${topReq.status}`,
          },
        ],
      };
    }
    return {
      reply: "You don't have an active request or coin yet. Want me to draft an invite request for you? ✨",
      mood: "warm",
      mode: "offline",
      cards: [{ kind: "request_form", prefillName: actor.name ?? "" }],
    };
  }

  // 7. FAQ intents: Dress code, Age limit, Plus-ones / Friends, Photos, ID
  const faqs = await listFaqs(db, actor);
  const byKey = (k: string) => faqs.find((f) => f.key === k);

  if (/\b(dress|wear|outfit|attire|kapde|code)\b/i.test(q)) {
    const next = await getNextInnercircleTeaser(db, actor);
    const faq = byKey("dress-code");
    const nightRule = next?.dressCode ? `For ${next.title}: "${next.dressCode}" ` : "";
    return {
      reply: `${nightRule}${faq?.answer ?? "Set per night, and the crew means it."} ✨`,
      mood: "warm",
      mode: "offline",
      cards: [],
    };
  }

  if (/\b(friend|plus one|plus-one|\+1|bring|companion|guest|dost|saath)\b/i.test(q)) {
    const faq = byKey("plus-ones");
    return {
      reply: `${faq?.answer ?? "Only if your coin allows a plus-one. Share their details when claiming your coin so the crew can review your RSVP."} 🖤`,
      mood: "warm",
      mode: "offline",
      cards: [],
    };
  }

  if (/\b(age|old|21\+|18\+|underage|id|identification)\b/i.test(q)) {
    const faq = byKey("age");
    return {
      reply: `${faq?.answer ?? "The demo nights are 21+, checked against the venue's licence."} 🖤`,
      mood: "warm",
      mode: "offline",
      cards: [],
    };
  }

  if (/\b(photo|camera|video|reel|instagram|shoot)\b/i.test(q)) {
    const faq = byKey("photos");
    return {
      reply: `${faq?.answer ?? "Of yourself, always. Of other guests, only with their consent."} ✨`,
      mood: "warm",
      mode: "offline",
      cards: [],
    };
  }

  // 8. Talk to human / crew handoff
  if (/\b(human|crew|organiser|organizer|whatsapp|help|support|stuck|contact|baat)\b/i.test(q)) {
    return {
      reply: "I can hand you straight to the Underdogs crew on WhatsApp. Tap the card below. 🖤",
      mood: "warm",
      mode: "offline",
      cards: [
        {
          kind: "handoff",
          whatsappUrl: CREW_WHATSAPP_URL,
          summary: `Guest question: "${message.slice(0, 120)}"`,
        },
      ],
    };
  }

  // 9. Past nights ("past", "Dolce Vita", "Launch", "Wonderland", "history")
  if (/\b(past|before|dolce vita|launch night|wonderland|last night|previous)\b/i.test(q)) {
    const past = await listPastNights(db, actor);
    const names = past.map((p) => p.title).join(", ");
    return {
      reply: `So far the circle has gathered for ${names}. Every night gets its own world while the gold coin stays the same. 🪩`,
      mood: "hype",
      mode: "offline",
      cards: [],
    };
  }

  // 10. Current time / relative date / Next night ("next night", "upcoming", "when", "what's on", "kab hai", "saturday", "tonight")
  if (/\b(next|upcoming|when|what's on|whats on|night|party|event|saturday|tonight|time|date|kab|party)\b/i.test(q)) {
    const next = await getNextInnercircleTeaser(db, actor);
    const pub = await listPublicNights(db, actor);
    const cards: GoldieCard[] = [];

    if (next) {
      cards.push({
        kind: "night",
        slug: next.slug,
        eventKind: "innercircle",
        title: next.title,
        tagline: next.tagline,
        when: `${formatDate(next.startsAt, next.timezone)}, ${formatTime(next.startsAt, next.timezone)} ${zoneLabel(next.timezone)}`,
        sound: next.soundTags,
        dressCode: next.dressCode,
        where: next.hasDropped
          ? "Dropped to confirmed guests 🔒"
          : "Location drops 72h before doors 🔒",
        isDemo: next.isDemo,
      });
    }
    if (pub.upcoming[0]) {
      const p = pub.upcoming[0];
      cards.push({
        kind: "night",
        slug: p.slug,
        eventKind: "public",
        title: p.title,
        tagline: p.tagline,
        when: `${formatDate(p.startsAt, p.timezone)}, ${formatTime(p.startsAt, p.timezone)} ${zoneLabel(p.timezone)}`,
        sound: p.soundTags,
        dressCode: p.dressCode,
        where: p.venue?.name ?? "Nagpur",
        externalUrl: p.sortmysceneUrl,
        isDemo: p.isDemo,
      });
    }

    const nowText = formatDate(at, "Asia/Kolkata");
    return {
      reply: hinglish
        ? `Aaj ${nowText} hai. Agli Innercircle night ${next?.title ?? "jald aa rahi"} hai — card neeche dekhein. ✨`
        : `Today is ${nowText} in Nagpur. Next inside the circle is ${next?.title ?? "being set"}, plus our public Underdogs Saturdays. ✨`,
      mood: "hype",
      mode: "offline",
      cards,
    };
  }

  // 11. Unknown / invented event check or general fallback
  const next = await getNextInnercircleTeaser(db, actor);
  void GOLDIE_SYSTEM_PROMPT;
  void getPublicNight;
  return {
    reply: hinglish
      ? `Main sirf official Underdogs aur Innercircle nights ki baat karta hoon. Agli night ${next?.title ?? "The Gold Room (Demo)"} hai — ya crew se WhatsApp par baat karein. 🖤`
      : `I only speak for nights on our slate — next up is ${next?.title ?? "The Gold Room (Demo)"}. Ask me about the next night, dress code, or how to request your coin. 🖤`,
    mood: "warm",
    mode: "offline",
    cards: next
      ? [
          {
            kind: "night",
            slug: next.slug,
            eventKind: "innercircle",
            title: next.title,
            tagline: next.tagline,
            when: `${formatDate(next.startsAt, next.timezone)}, ${formatTime(next.startsAt, next.timezone)} ${zoneLabel(next.timezone)}`,
            sound: next.soundTags,
            dressCode: next.dressCode,
            where: "Location drops 72h before doors 🔒",
            isDemo: next.isDemo,
          },
        ]
      : [],
  };
}
