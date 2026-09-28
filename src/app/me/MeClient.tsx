"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  deleteMyDataAction,
  sendOtpAction,
  signOutAction,
  verifyOtpAndSignInAction,
} from "@/app/actions/innercircle";
import { DemoTag, Frame } from "@/components/brand/Frame";
import logo from "../../../public/brand/logo.jpg";

type SignInProps = {
  mode: "signin";
};

type DashboardProps = {
  mode: "dashboard";
  guestName: string | null;
  guestPhone: string;
  coins: {
    id: string;
    serialFormatted: string;
    engraving: string;
    status: string;
    rsvpStatus: string;
    plusOnes: number;
  }[];
  requests: {
    id: string;
    name: string;
    status: string;
    createdAtIso: string;
  }[];
  waitlists: {
    id: string;
    status: string;
  }[];
  messages: {
    id: string;
    template: string;
    body: string;
    coinUrl?: string;
    createdAtIso: string;
  }[];
  nextNight: {
    slug: string;
    title: string;
    hasDropped: boolean;
    venue: { name: string; address: string | null; city: string; mapsUrl: string | null } | null;
  } | null;
};

export function MeClient(props: SignInProps | DashboardProps) {
  const router = useRouter();
  const baseId = useId();
  const [phone, setPhone] = useState("+91 90000 10002");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await sendOtpAction(phone);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOtpSentTo(res.phone);
    if (res.demoCode) {
      setDemoOtp(res.demoCode);
      setOtpCode(res.demoCode);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await verifyOtpAndSignInAction({ phone: otpSentTo ?? phone, code: otpCode });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDeleteData() {
    setBusy(true);
    const res = await deleteMyDataAction();
    setBusy(false);
    if (res.ok) router.push("/");
  }

  if (props.mode === "signin") {
    return (
      <Frame bodyClassName="flex max-w-xl flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Member Vault · Sign In</p>
          <DemoTag />
        </div>
        <h2 className="font-serif text-3xl text-heading">Open Your Coin</h2>
        <p className="text-sm text-text-dim">
          Sign in with your verified Indian mobile number (or use the Demo Panel at the bottom-left to switch between{" "}
          <strong>Aarav</strong>, <strong>Meera</strong>, <strong>Kabir</strong>, and <strong>Admin</strong>).
        </p>

        {!otpSentTo ? (
          <form onSubmit={handleSendOtp} method="POST" className="flex flex-col gap-4">
            <div>
              <label htmlFor={`${baseId}-phone`} className="block text-sm font-medium text-text mb-1.5">
                Mobile number (required)
              </label>
              <input
                id={`${baseId}-phone`}
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-text focus:border-rule"
              />
              <p className="mt-1 text-xs text-text-dim">
                Demo numbers: Meera <code>+91 90000 10002</code> · Aarav <code>+91 90000 10001</code>
              </p>
            </div>
            {error ? <p className="text-sm text-drop-text">{error}</p> : null}
            <button type="submit" disabled={busy} className="btn btn-gold self-start">
              {busy ? "Sending code..." : "Send OTP Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} method="POST" className="flex flex-col gap-4">
            {demoOtp ? (
              <div className="rounded-xl border border-rule bg-surface-raised p-4 text-sm">
                <span className="eyebrow block">Demo OTP Toast</span>
                <p className="mt-1 text-text">
                  Code for <strong>{otpSentTo}</strong>:{" "}
                  <strong className="font-display text-lg text-accent tracking-widest">{demoOtp}</strong>
                </p>
              </div>
            ) : null}
            <div>
              <label htmlFor={`${baseId}-otp`} className="block text-sm font-medium text-text mb-1.5">
                6-digit OTP code (required)
              </label>
              <input
                id={`${baseId}-otp`}
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full max-w-xs rounded-xl border border-border bg-bg px-4 py-3 font-display text-lg tracking-widest text-text"
              />
            </div>
            {error ? <p className="text-sm text-drop-text">{error}</p> : null}
            <button type="submit" disabled={busy} className="btn btn-gold self-start">
              {busy ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>
        )}
      </Frame>
    );
  }

  const primaryCoin = props.coins[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="eyebrow">Signed in as {props.guestPhone}</p>
          <h1 className="mt-1 font-serif text-4xl text-heading">{props.guestName ?? "Innercircle Guest"}</h1>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOutAction();
            router.refresh();
          }}
          className="btn btn-ghost text-xs"
        >
          Sign out
        </button>
      </div>

      {/* Primary Coin Card */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Frame bodyClassName="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex w-full items-center justify-between">
            <span className="eyebrow">Your Innercircle Coin</span>
            <DemoTag />
          </div>

          {primaryCoin ? (
            <>
              <Image
                src={logo}
                alt={`Gold coin engraved for ${primaryCoin.engraving}`}
                sizes="12rem"
                className="coin-photo h-48 w-48"
              />
              <p className="font-display text-xs tracking-widest text-accent">{primaryCoin.serialFormatted}</p>
              <p className="diamond-caps font-display text-2xl font-semibold tracking-[0.18em]">
                {primaryCoin.engraving}
              </p>
              <p className="text-sm text-text-dim">
                {primaryCoin.rsvpStatus === "confirmed"
                  ? "RSVP Confirmed by the Innercircle crew ✨"
                  : primaryCoin.rsvpStatus === "pending_review"
                    ? "RSVP details submitted — the Innercircle crew will get back to you personally."
                    : "Coin issued — open your coin link in the WhatsApp preview below to submit your RSVP details."}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="font-serif text-2xl text-heading">No coin minted yet</p>
              <p className="max-w-sm text-sm text-text-dim">
                Once the crew approves your invite request, your personal coin link arrives on WhatsApp.
              </p>
              <Link href="/innercircle#request-form" className="btn btn-gold mt-2">
                Request your coin
              </Link>
            </div>
          )}
        </Frame>

        {/* Next Night & Drop Status */}
        <Frame bodyClassName="flex flex-col justify-between gap-5 p-6">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">Location Drop &amp; Status</span>
            {props.nextNight ? (
              <>
                <h2 className="font-night text-3xl text-heading">{props.nextNight.title}</h2>
                {props.nextNight.venue ? (
                  <div className="rounded-xl border border-rule bg-surface-raised p-4">
                    <span className="eyebrow text-accent">Location Dropped 📍</span>
                    <p className="mt-1 font-serif text-xl text-heading">{props.nextNight.venue.name}</p>
                    <p className="text-sm text-text">
                      {[props.nextNight.venue.address, props.nextNight.venue.city].filter(Boolean).join(", ")}
                    </p>
                    {props.nextNight.venue.mapsUrl ? (
                      <a
                        href={props.nextNight.venue.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 btn btn-gold text-xs py-2 px-4"
                      >
                        Open in Google Maps ↗
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-bg p-4">
                    <span className="eyebrow">Address Redacted 🔒</span>
                    <p className="mt-1 text-sm text-text-dim">
                      The exact venue address and Google Maps link unlock 72 hours before doors for confirmed
                      coin-holders.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-text-dim">No upcoming Innercircle night scheduled.</p>
            )}

            {props.requests.length ? (
              <div className="mt-2 border-t border-border pt-3">
                <p className="eyebrow">Invite Requests</p>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {props.requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2">
                      <span>{r.name}</span>
                      <span className="font-display text-xs tracking-wider text-accent uppercase">{r.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {props.waitlists.length ? (
              <div className="border-t border-border pt-3">
                <p className="eyebrow">Waitlist</p>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {props.waitlists.map((w) => (
                    <li key={w.id} className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2">
                      <span>The Gold Room (Demo)</span>
                      <span className="font-display text-xs tracking-wider text-accent uppercase">{w.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {props.nextNight ? (
            <Link href={`/innercircle/${props.nextNight.slug}`} className="btn btn-ghost self-start">
              View Night Page →
            </Link>
          ) : null}
        </Frame>
      </div>

      {/* WhatsApp Messages Sent to This Member */}
      <Frame bodyClassName="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">WhatsApp Outbox (Demo Preview)</p>
            <h2 className="mt-1 font-serif text-2xl text-heading">Messages from the Circle</h2>
          </div>
          <DemoTag />
        </div>
        {props.messages.length ? (
          <ul className="flex flex-col gap-3">
            {props.messages.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="eyebrow text-[0.65rem]">{m.template.replace(/_/g, " ")}</span>
                  <p className="mt-1 text-text">{m.body}</p>
                </div>
                {m.coinUrl ? (
                  <Link href={m.coinUrl} className="btn btn-gold text-xs shrink-0">
                    Open Coin Link →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-dim">No WhatsApp messages sent to your number yet.</p>
        )}
      </Frame>

      {/* DPDP Privacy & Data Deletion */}
      <div className="rounded-2xl border border-border bg-surface/60 p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Privacy · India DPDP Act</p>
          <p className="mt-1 text-xs text-text-dim">
            We store only what the Innercircle needs (your verified phone, name, request answers, and coin status). You
            may permanently erase your records at any time.
          </p>
        </div>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn btn-ghost text-xs shrink-0"
          >
            Delete my data
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={handleDeleteData}
              className="btn bg-drop text-text text-xs px-4 py-2"
            >
              Confirm permanent erase
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn btn-ghost text-xs px-3 py-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
