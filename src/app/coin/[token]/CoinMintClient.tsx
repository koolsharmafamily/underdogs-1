"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  claimCoinAction,
  sendOtpAction,
  verifyOtpAndSignInAction,
} from "@/app/actions/innercircle";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { TailsArt } from "@/components/brand/TailsArt";
import type { CoinView } from "@/lib/domain/innercircle";
import { useStage } from "@/three/store";
import logo from "../../../../public/brand/logo.jpg";

type Props = {
  token: string;
  coin: CoinView;
  actor:
    | { kind: "anonymous" }
    | { kind: "guest"; guestId: string; name: string | null; phone: string; role: string };
};

export function CoinMintClient({ token, coin, actor }: Props) {
  const router = useRouter();
  const baseId = useId();
  const setGoldieState = useStage((s) => s.setGoldieState);

  // OTP state when anonymous
  const [phone, setPhone] = useState("+91 90000 10001");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Claim & RSVP form state
  const [name, setName] = useState(
    coin.claimDetails?.name ?? (actor.kind === "guest" ? (actor.name ?? "") : "Aarav (Demo)"),
  );
  const [instagram, setInstagram] = useState(coin.claimDetails?.instagramHandle ?? "aarav.demo");
  const [companionDetails, setCompanionDetails] = useState(
    coin.claimDetails?.companionDetails ?? (coin.plusOnes > 0 ? "Bringing 1 guest" : "Attending solo"),
  );
  const [note, setNote] = useState(coin.claimDetails?.note ?? "Count me in for The Gold Room.");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedNotice, setMintedNotice] = useState<string | null>(
    coin.status === "claimed" && coin.rsvpStatus === "pending_review"
      ? "Your coin is minted and your details are with the Innercircle. The Innercircle crew will get back to you personally regarding your RSVP confirmation."
      : null,
  );
  const [flipped, setFlipped] = useState(false);

  const liveEngraving =
    name
      .replace(/\(demo\)/gi, "")
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 14) || coin.engraving;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    const res = await sendOtpAction(phone);
    setAuthBusy(false);
    if (!res.ok) {
      setAuthError(res.error);
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
    setAuthBusy(true);
    setAuthError(null);
    const res = await verifyOtpAndSignInAction({ phone: otpSentTo ?? phone, code: otpCode, name });
    setAuthBusy(false);
    if (!res.ok) {
      setAuthError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleClaimSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await claimCoinAction({
      token,
      name,
      instagramHandle: instagram,
      companionDetails,
      note,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setGoldieState("celebrating", "celebrate");
    setMintedNotice(res.notificationMessage);
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-start">
      {/* Left: The Minted Personal Coin Display */}
      <Frame bodyClassName="relative flex flex-col items-center gap-5 overflow-hidden p-6 text-center sm:p-8">
        <div className="night-art-vault pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative z-10 flex w-full items-center justify-between">
          <span className="eyebrow">Season {coin.season}</span>
          <span className="font-display text-sm tracking-widest text-accent">{coin.serialFormatted}</span>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="group relative z-10 my-2 flex h-64 w-64 items-center justify-center rounded-full focus:outline-none"
          aria-label="Flip coin between heads and tails"
        >
          {!flipped ? (
            <div className="relative flex h-full w-full items-center justify-center">
              <Image
                src={logo}
                alt={`Personal Underdogs Innercircle coin engraved for ${liveEngraving}`}
                sizes="16rem"
                className="coin-photo h-64 w-64 transition-transform duration-500 group-hover:scale-105"
              />
              <span className="coin-glint" aria-hidden />
            </div>
          ) : (
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-full border border-rule bg-bg-deep p-6 shadow-inner">
              <TailsArt className="h-28 w-28" />
              <p className="mt-2 font-display text-xs tracking-widest text-accent">{coin.serialFormatted}</p>
            </div>
          )}
        </button>

        <div className="relative z-10 flex flex-col items-center gap-1">
          <p className="eyebrow">Rim Engraving</p>
          <p
            data-testid="coin-engraving"
            className="diamond-caps font-display text-3xl font-semibold tracking-[0.18em]"
          >
            {liveEngraving}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            {coin.plusOnes > 0 ? `Admits member + ${coin.plusOnes} companion` : "Personal member invite (solo)"} · Tap
            coin to flip
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 pt-2">
          <span className="rounded-full border border-rule bg-surface-raised px-3 py-1 text-xs text-accent uppercase tracking-wider">
            Coin: {coin.status}
          </span>
          <span className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-text-dim uppercase tracking-wider">
            RSVP: {coin.rsvpStatus.replace("_", " ")}
          </span>
          <DemoTag />
        </div>
      </Frame>

      {/* Right: Claim Details & Exclusive Innercircle RSVP Review Notification */}
      <Frame bodyClassName="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <p className="eyebrow">Step 3 &amp; 4 · Your Coin &amp; Innercircle RSVP</p>
          <h1 className="mt-1 font-serif text-3xl text-heading sm:text-4xl">
            {coin.status === "claimed" ? "Your Coin is Minted" : "Claim Your Personal Coin"}
          </h1>
          <p className="mt-2 text-sm text-text-dim">
            {coin.event
              ? `For ${coin.event.title}. Enter your details below to bind this coin to your phone and submit your RSVP to the Innercircle crew.`
              : "Enter your details below to bind this coin to your phone and submit your RSVP to the Innercircle crew."}
          </p>
        </div>

        {coin.isBoundToOther ? (
          <div role="alert" className="rounded-2xl border border-drop bg-bg p-5 text-sm text-text">
            <p className="font-serif text-xl text-heading">Bound to another member</p>
            <p className="mt-1 text-text-dim">
              This personal coin link is already bound to another verified phone number ({coin.intendedPhoneHint ?? "private"}).
              In the Demo Panel, switch persona to the invited guest to view or claim this coin.
            </p>
          </div>
        ) : mintedNotice || coin.rsvpStatus === "confirmed" ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="rsvp-review-notification"
            className="flex flex-col gap-4 rounded-2xl border border-rule bg-surface-raised p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">
                {coin.rsvpStatus === "confirmed"
                  ? "Innercircle RSVP Confirmed ✨"
                  : "Innercircle RSVP Notification"}
              </span>
              <span className="font-display text-xs tracking-widest text-accent">{coin.serialFormatted}</span>
            </div>

            <h2 className="font-serif text-2xl text-heading">
              {coin.rsvpStatus === "confirmed"
                ? "You are confirmed on the Innercircle list."
                : "The Innercircle will get back to you regarding your RSVP."}
            </h2>

            <p className="text-sm leading-relaxed text-text">
              {coin.rsvpStatus === "confirmed"
                ? "Your spot inside the room is locked. The exact venue address and Google Maps link unlock 72 hours before doors."
                : mintedNotice}
            </p>

            {coin.claimDetails ? (
              <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 border-t border-border pt-4 text-xs">
                <dt className="text-text-dim">Engraved for</dt>
                <dd className="text-text font-medium">{coin.claimDetails.name} ({liveEngraving})</dd>
                {coin.claimDetails.instagramHandle ? (
                  <>
                    <dt className="text-text-dim">Instagram</dt>
                    <dd className="text-text">@{coin.claimDetails.instagramHandle}</dd>
                  </>
                ) : null}
                {coin.claimDetails.companionDetails ? (
                  <>
                    <dt className="text-text-dim">Attendance</dt>
                    <dd className="text-text">{coin.claimDetails.companionDetails}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              {coin.event ? (
                <Link href={`/innercircle/${coin.event.slug}`} className="btn btn-gold">
                  Open Night &amp; Drop Page
                </Link>
              ) : null}
              <Link href="/me" className="btn btn-ghost">
                Open Your Coin Vault
              </Link>
            </div>
          </div>
        ) : actor.kind === "anonymous" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-dim">
              First, verify your phone number to bind Coin <strong>{coin.serialFormatted}</strong> to your device
              {coin.intendedPhoneHint ? ` (issued for ${coin.intendedPhoneHint})` : ""}.
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
                </div>
                {authError ? <p className="text-sm text-drop-text">{authError}</p> : null}
                <button type="submit" disabled={authBusy} className="btn btn-gold self-start">
                  {authBusy ? "Sending code..." : "Send OTP to Claim Coin"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} method="POST" className="flex flex-col gap-4">
                {demoOtp ? (
                  <div className="rounded-xl border border-rule bg-surface-raised p-4 text-sm">
                    <span className="eyebrow block">Demo OTP Toast</span>
                    <p className="mt-1 text-text">
                      OTP for <strong>{otpSentTo}</strong>:{" "}
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
                {authError ? <p className="text-sm text-drop-text">{authError}</p> : null}
                <button type="submit" disabled={authBusy} className="btn btn-gold self-start">
                  {authBusy ? "Verifying..." : "Verify Phone"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleClaimSubmit} method="POST" className="flex flex-col gap-4">
            <div>
              <label htmlFor={`${baseId}-name`} className="block text-sm font-medium text-text mb-1.5">
                Full name for rim engraving &amp; RSVP (required)
              </label>
              <input
                id={`${baseId}-name`}
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
              />
            </div>

            <div>
              <label htmlFor={`${baseId}-ig`} className="block text-sm font-medium text-text mb-1.5">
                Instagram handle (required for Innercircle curation)
              </label>
              <input
                id={`${baseId}-ig`}
                name="instagramHandle"
                type="text"
                required
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourhandle"
                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
              />
            </div>

            <div>
              <label htmlFor={`${baseId}-comp`} className="block text-sm font-medium text-text mb-1.5">
                {coin.plusOnes > 0
                  ? `Companion details (your coin allows up to +${coin.plusOnes})`
                  : "Attendance details"}
              </label>
              <input
                id={`${baseId}-comp`}
                name="companionDetails"
                type="text"
                value={companionDetails}
                onChange={(e) => setCompanionDetails(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
              />
            </div>

            <div>
              <label htmlFor={`${baseId}-note`} className="block text-sm font-medium text-text mb-1.5">
                Note for the Innercircle crew (optional)
              </label>
              <textarea
                id={`${baseId}-note`}
                name="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
              />
            </div>

            {error ? (
              <p role="alert" aria-live="polite" className="text-sm text-drop-text">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={submitting} className="btn btn-gold self-start">
              {submitting ? "Minting Coin & Submitting RSVP..." : "Claim Coin & Submit RSVP Details"}
            </button>
          </form>
        )}
      </Frame>
    </div>
  );
}
