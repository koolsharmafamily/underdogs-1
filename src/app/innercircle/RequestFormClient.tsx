"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  sendOtpAction,
  submitInviteRequestAction,
  verifyOtpAndSignInAction,
} from "@/app/actions/innercircle";
import { DemoTag, Frame } from "@/components/brand/Frame";
import { useStage } from "@/three/store";

const NIGHT_CHOICES = [
  "La Dolce Vita, 80s edition",
  "Launch night × Live By All Means",
  "Underdogs Wonderland – NYE 2026",
  "House & Afro nights",
  "First time at Underdogs",
] as const;

type Props = {
  actor:
    | { kind: "anonymous" }
    | { kind: "guest"; guestId: string; name: string | null; phone: string; role: string };
  existingStatus?: string | null;
};

export function RequestFormClient({ actor, existingStatus }: Props) {
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

  // Request form state
  const [name, setName] = useState(actor.kind === "guest" ? (actor.name ?? "") : "Aarav (Demo)");
  const [instagram, setInstagram] = useState(actor.kind === "guest" ? "aarav.demo" : "");
  const [selectedNights, setSelectedNights] = useState<string[]>(["La Dolce Vita, 80s edition"]);
  const [bringing, setBringing] = useState("Coming solo, or with one close friend from the La Dolce Vita night.");
  const [vouchCode, setVouchCode] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(existingStatus ?? null);

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

  function toggleNight(choice: string) {
    setSelectedNights((prev) =>
      prev.includes(choice) ? prev.filter((c) => c !== choice) : [...prev, choice],
    );
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setFormError("Please confirm consent for Innercircle updates.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await submitInviteRequestAction({
      name,
      instagramHandle: instagram,
      nights: selectedNights,
      bringing,
      vouchCode,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setGoldieState("celebrating", "celebrate");
    setSubmittedStatus(res.status);
    router.refresh();
  }

  if (submittedStatus) {
    return (
      <Frame bodyClassName="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">Request on file</p>
          <DemoTag />
        </div>
        <h3 className="font-serif text-3xl text-heading">Your request is with the crew. ✨</h3>
        <p className="text-text-dim">
          Current status: <strong className="text-accent uppercase">{submittedStatus}</strong>. Every request is read by
          hand. When approved, your personal coin link arrives on WhatsApp (and in the Demo Outbox preview).
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/me" className="btn btn-gold">
            View status in Your Coin
          </Link>
          <Link href="/crew" className="btn btn-ghost">
            Open Crew Review Queue (Demo)
          </Link>
          <button
            type="button"
            onClick={() => setSubmittedStatus(null)}
            className="btn btn-ghost text-xs"
          >
            Submit another request
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame bodyClassName="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <p className="eyebrow">Step 1 · Request an invite</p>
          <h3 className="mt-1 font-serif text-2xl text-heading sm:text-3xl">Ask for your coin</h3>
        </div>
        <DemoTag />
      </div>

      {actor.kind === "anonymous" ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-dim">
            Your phone number is your identity in the circle. Verify it with a one-time code first (or switch persona to{" "}
            <strong className="text-text">Aarav (Demo)</strong> in the Demo Panel).
          </p>

          {!otpSentTo ? (
            <form onSubmit={handleSendOtp} method="POST" className="flex flex-col gap-4">
              <div>
                <label htmlFor={`${baseId}-phone`} className="block text-sm font-medium text-text mb-1.5">
                  Indian mobile number (required)
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
                  Demo tip: use <code>+91 90000 10001</code> for Aarav (Demo).
                </p>
              </div>
              {authError ? (
                <p role="alert" aria-live="polite" className="text-sm text-drop-text">
                  {authError}
                </p>
              ) : null}
              <button type="submit" disabled={authBusy} className="btn btn-gold self-start">
                {authBusy ? "Sending code..." : "Send OTP code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} method="POST" className="flex flex-col gap-4">
              {demoOtp ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-rule bg-surface-raised p-4 text-sm"
                >
                  <span className="eyebrow block">Demo OTP Toast</span>
                  <p className="mt-1 text-text">
                    Your 6-digit verification code for <strong>{otpSentTo}</strong> is{" "}
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
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full max-w-xs rounded-xl border border-border bg-bg px-4 py-3 font-display text-lg tracking-widest text-text focus:border-rule"
                />
              </div>

              {authError ? (
                <p role="alert" aria-live="polite" className="text-sm text-drop-text">
                  {authError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={authBusy} className="btn btn-gold">
                  {authBusy ? "Verifying..." : "Verify & Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSentTo(null);
                    setDemoOtp(null);
                  }}
                  className="btn btn-ghost text-xs"
                >
                  Change number
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmitRequest} method="POST" className="flex flex-col gap-5">
          <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-xs text-text-dim flex flex-wrap items-center justify-between gap-2">
            <span>
              Verified phone: <strong className="text-text">{actor.phone}</strong>
            </span>
            <span>Role: {actor.role}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-name`} className="block text-sm font-medium text-text mb-1.5">
                Full name (required)
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
                Instagram handle (optional)
              </label>
              <input
                id={`${baseId}-ig`}
                name="instagramHandle"
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourhandle"
                className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-text mb-1">
              Which Underdogs / Innercircle nights or sounds do you vibe with? (required)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {NIGHT_CHOICES.map((choice) => {
                const checked = selectedNights.includes(choice);
                return (
                  <label
                    key={choice}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                      checked ? "border-rule bg-surface-raised text-heading" : "border-border bg-bg text-text-dim"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="nights"
                      value={choice}
                      checked={checked}
                      onChange={() => toggleNight(choice)}
                      className="accent-accent h-4 w-4"
                    />
                    <span>{choice}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${baseId}-bringing`} className="block text-sm font-medium text-text mb-1.5">
              Who would you bring into the room?
            </label>
            <textarea
              id={`${baseId}-bringing`}
              name="bringing"
              rows={2}
              value={bringing}
              onChange={(e) => setBringing(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
            />
          </div>

          <div>
            <label htmlFor={`${baseId}-vouch`} className="block text-sm font-medium text-text mb-1.5">
              Member vouch code (optional — speeds review)
            </label>
            <input
              id={`${baseId}-vouch`}
              name="vouchCode"
              type="text"
              value={vouchCode}
              onChange={(e) => setVouchCode(e.target.value)}
              placeholder="e.g. GOLD-MEERA"
              className="w-full max-w-xs rounded-xl border border-border bg-bg px-4 py-2.5 text-text focus:border-rule"
            />
          </div>

          <label className="flex items-start gap-3 text-xs text-text-dim cursor-pointer">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent"
            />
            <span>
              I consent to Underdogs Innercircle storing my phone number and request details to review my invite and send
              WhatsApp updates (DPDP Act compliant; you can delete your data anytime in{" "}
              <Link href="/me" className="text-accent underline">
                Your coin
              </Link>
              ).
            </span>
          </label>

          {formError ? (
            <p role="alert" aria-live="polite" className="text-sm text-drop-text">
              {formError}
            </p>
          ) : null}

          <button type="submit" disabled={submitting} className="btn btn-gold self-start">
            {submitting ? "Submitting to the crew..." : "Submit Invite Request"}
          </button>
        </form>
      )}
    </Frame>
  );
}
