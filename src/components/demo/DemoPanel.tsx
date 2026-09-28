"use client";
/*
  The demo panel: a floating control drawer opened with the "Demo" pill or Shift+D.
  Includes Persona switching, Time Travel, World/Theme override, 3D Quality Tier
  override, Waitlist cancellation hand-off, Phone-frame WhatsApp Outbox preview,
  and 1-click Demo Reset (no ticketing or payment controls).
*/
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState, useTransition } from "react";
import {
  getDemoStateAction,
  resetDemoAction,
  setThemeOverride,
  simulateCancellationAction,
  switchDemoPersona,
  timeTravelAction,
  type DemoPersonaKey,
} from "@/app/actions/demo";
import type { TimeTravel } from "@/lib/domain/demo";
import { THEMES } from "@/themes";
import { useStage, type Tier } from "@/three/store";
import { saveTierOverride } from "@/three/tier";

const TIER_LABELS: Record<Tier, string> = { full: "Full", lite: "Lite", still: "Still", none: "No WebGL" };

const PERSONAS: { key: DemoPersonaKey; label: string }[] = [
  { key: "anonymous", label: "Signed out" },
  { key: "aarav", label: "Aarav (Demo)" },
  { key: "meera", label: "Meera (Demo)" },
  { key: "kabir", label: "Kabir (Demo)" },
  { key: "admin", label: "Crew / Admin (Demo)" },
];

type DemoState = Awaited<ReturnType<typeof getDemoStateAction>>;

export function DemoPanel({ themeOverride }: { themeOverride: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, setState] = useState<DemoState | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const router = useRouter();
  const tier = useStage((s) => s.tier);
  const detected = useStage((s) => s.detected);
  const override = useStage((s) => s.override);
  const titleId = useId();

  const refreshDemoState = useCallback(async () => {
    try {
      const s = await getDemoStateAction();
      setState(s);
    } catch {
      // ignore transient errors
    }
  }, []);

  const toggleOpen = useCallback(
    (nextOpen?: boolean) => {
      setOpen((prev) => {
        const target = nextOpen ?? !prev;
        if (target) void refreshDemoState();
        return target;
      });
    },
    [refreshDemoState],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.shiftKey && (e.key === "D" || e.key === "d")) toggleOpen();
      if (e.key === "Escape") toggleOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleOpen]);

  const chooseWorld = (theme: string | null) =>
    start(async () => {
      await setThemeOverride(theme);
      await refreshDemoState();
      router.refresh();
    });

  const chooseTier = (t: Tier | null) => {
    saveTierOverride(t);
    useStage.getState().setOverride(t);
  };

  const choosePersona = (p: DemoPersonaKey) =>
    start(async () => {
      setStatusMsg(null);
      await switchDemoPersona(p);
      await refreshDemoState();
      router.refresh();
    });

  const runTimeTravel = (to: TimeTravel) =>
    start(async () => {
      setStatusMsg(null);
      await timeTravelAction(to);
      await refreshDemoState();
      router.refresh();
      setStatusMsg(to === "to_drop" ? "Jumped to Location Drop!" : to === "reset" ? "Clock reset." : "Clock advanced.");
    });

  const runSimulateCancel = () =>
    start(async () => {
      try {
        const res = await simulateCancellationAction();
        await refreshDemoState();
        router.refresh();
        setStatusMsg(
          res.offeredToGuestName
            ? `Spot freed! Timed coin offer sent to ${res.offeredToGuestName}.`
            : "Spot freed.",
        );
      } catch (e) {
        setStatusMsg(e instanceof Error ? e.message : "Could not cancel.");
      }
    });

  const runReset = () =>
    start(async () => {
      await resetDemoAction();
      await refreshDemoState();
      router.refresh();
      setStatusMsg("Demo data reset to clean seed state.");
    });

  const seg = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
      active ? "bg-accent text-on-accent" : "text-text-dim hover:text-accent"
    }`;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2 font-sans">
      {open ? (
        <section
          role="dialog"
          aria-labelledby={titleId}
          className="max-h-[82dvh] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-rule bg-surface p-4 shadow-2xl flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 id={titleId} className="eyebrow">
              Demo Controls (Shift+D)
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-text-dim hover:text-accent cursor-pointer"
            >
              Close
            </button>
          </div>

          {statusMsg ? (
            <p role="status" aria-live="polite" className="rounded-lg border border-rule bg-surface-raised px-3 py-2 text-xs text-accent">
              {statusMsg}
            </p>
          ) : null}

          {/* 1. Persona Switcher */}
          <fieldset disabled={pending}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-accent-muted">
              Persona ({state?.actor.kind === "guest" ? state.actor.name : "Signed out"})
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-border p-1">
              {PERSONAS.map((p) => {
                const isCurrent =
                  (p.key === "anonymous" && state?.actor.kind === "anonymous") ||
                  (state?.actor.kind === "guest" &&
                    state.actor.name?.toLowerCase().startsWith(p.key === "admin" ? "admin" : p.key));
                return (
                  <button
                    key={p.key}
                    type="button"
                    className={seg(Boolean(isCurrent))}
                    onClick={() => choosePersona(p.key)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 2. Time Travel */}
          <fieldset disabled={pending}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-accent-muted">
              Time Travel {state?.nowIso ? `· ${new Date(state.nowIso).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-border p-1">
              <button type="button" className={seg(false)} onClick={() => runTimeTravel("plus_hour")}>
                +1h
              </button>
              <button type="button" className={seg(Boolean(state?.nextNight?.hasDropped))} onClick={() => runTimeTravel("to_drop")}>
                Jump to drop
              </button>
              <button type="button" className={seg(false)} onClick={() => runTimeTravel("to_doors")}>
                Jump to doors
              </button>
              <button type="button" className={seg(false)} onClick={() => runTimeTravel("reset")}>
                Reset clock
              </button>
            </div>
          </fieldset>

          {/* 3. Theme Override */}
          <fieldset disabled={pending}>
            <legend className="text-xs font-semibold uppercase tracking-wider text-accent-muted">World Theme</legend>
            <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-border p-1">
              <button
                type="button"
                className={seg(themeOverride === null)}
                aria-pressed={themeOverride === null}
                onClick={() => chooseWorld(null)}
              >
                Next night
              </button>
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={seg(themeOverride === t.id)}
                  aria-pressed={themeOverride === t.id}
                  onClick={() => chooseWorld(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </fieldset>

          {/* 4. 3D Quality Tier */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-accent-muted">3D Tier</legend>
            <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-border p-1">
              <button
                type="button"
                className={seg(override === null)}
                aria-pressed={override === null}
                onClick={() => chooseTier(null)}
              >
                Auto
              </button>
              {(Object.keys(TIER_LABELS) as Tier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={seg(override === t)}
                  aria-pressed={override === t}
                  onClick={() => chooseTier(t)}
                >
                  {TIER_LABELS[t]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[0.7rem] text-text-dim">
              Active: {TIER_LABELS[tier]} (Detected: {TIER_LABELS[detected]})
            </p>
          </fieldset>

          {/* 5. Waitlist & Reset Actions */}
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              disabled={pending}
              onClick={runSimulateCancel}
              className="rounded-full border border-rule bg-surface-raised px-3 py-1.5 text-xs text-accent hover:bg-bg cursor-pointer"
            >
              Simulate RSVP cancellation
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={runReset}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-text-dim hover:text-accent cursor-pointer"
            >
              Reset demo data
            </button>
          </div>

          {/* 6. Phone-frame WhatsApp Outbox Preview */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-muted">
              WhatsApp Outbox Preview ({state?.outbox.length ?? 0})
            </p>
            <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-bg p-2.5 text-xs">
              {state?.outbox.length ? (
                state.outbox.map((m) => (
                  <div key={m.id} className="rounded-xl border border-border bg-surface-raised p-2.5">
                    <div className="flex items-center justify-between text-[0.65rem] text-accent-muted">
                      <span className="uppercase">{m.template.replace(/_/g, " ")}</span>
                      <span>{m.toPhone}</span>
                    </div>
                    <p className="mt-1 text-text">{m.body}</p>
                    {m.vars?.coinUrl ? (
                      <Link
                        href={m.vars.coinUrl}
                        onClick={() => setOpen(false)}
                        className="mt-1 inline-block font-semibold text-accent underline"
                      >
                        Open Coin Link ({m.vars.coinUrl}) →
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-text-dim">No messages yet.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => toggleOpen()}
        aria-expanded={open}
        className="rounded-full border border-rule bg-surface px-3.5 py-1.5 text-xs font-semibold tracking-wider text-accent uppercase shadow-lg hover:bg-surface-raised cursor-pointer"
        title="Demo controls (Shift+D)"
      >
        Demo
      </button>
    </div>
  );
}
