/*
  Shared state between the DOM and the canvas. No three.js imports here, so
  pages can use it without pulling in the 3D chunk.

  Two kinds of state:
  - useStage: things React renders from (tier, theme, readiness, view slots,
    and Goldie's presence state). They change on discrete events.
  - motion: a mutable object that ScrollTrigger writes and useFrame reads.
    Never put per-frame values in React state.
*/
import type { RefObject } from "react";
import { create } from "zustand";

export type Tier = "full" | "lite" | "still" | "none";
export const TIERS: readonly Tier[] = ["full", "lite", "still", "none"];
export type SlotName = "home";

export type GoldiePresence =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "celebrating"
  | "hushed"
  | "sorry";

export type GoldieMood = "warm" | "hype" | "hushed" | "sorry" | "celebrate";

type StageState = {
  /** The tier in use: detected, or the demo panel's override. */
  tier: Tier;
  detected: Tier;
  override: Tier | null;
  /** True once the canvas has drawn its first frame. */
  ready: boolean;
  theme: string;
  slots: Partial<Record<SlotName, RefObject<HTMLElement | null>>>;
  goldieState: GoldiePresence;
  goldieMood: GoldieMood;
  setDetected: (tier: Tier) => void;
  setOverride: (tier: Tier | null) => void;
  /** PerformanceMonitor asks for less. Only ever steps Full down to Lite. */
  degrade: () => void;
  setReady: (ready: boolean) => void;
  setTheme: (theme: string) => void;
  setGoldieState: (goldieState: GoldiePresence, goldieMood?: GoldieMood) => void;
  registerSlot: (name: SlotName, ref: RefObject<HTMLElement | null>) => void;
  unregisterSlot: (name: SlotName, ref: RefObject<HTMLElement | null>) => void;
};

export const useStage = create<StageState>((set, get) => ({
  tier: "full",
  detected: "full",
  override: null,
  ready: false,
  theme: "vault",
  slots: {},
  goldieState: "idle",
  goldieMood: "warm",
  setDetected: (detected) => set({ detected, tier: get().override ?? detected }),
  setOverride: (override) => set({ override, tier: override ?? get().detected }),
  degrade: () => {
    const { detected, override } = get();
    if (!override && detected === "full") set({ detected: "lite", tier: "lite" });
  },
  setReady: (ready) => set({ ready }),
  setTheme: (theme) => set({ theme }),
  setGoldieState: (goldieState, goldieMood) =>
    set({ goldieState, ...(goldieMood ? { goldieMood } : {}) }),
  registerSlot: (name, ref) => set({ slots: { ...get().slots, [name]: ref } }),
  unregisterSlot: (name, ref) => {
    const slots = { ...get().slots };
    if (slots[name] === ref) delete slots[name];
    set({ slots });
  },
}));

/**
 * The layout switch shared by CSS (the `wide:` variant in globals.css) and the
 * 3D keyframes: text beside the coin on wide screens, under it on narrow ones.
 */
export function isNarrow(width: number, height: number): boolean {
  return width < 640 || width / Math.max(1, height) < 0.9;
}

/** The six home chapters, in order. */
export const CHAPTERS = ["vault", "heads", "drop", "circle", "keeper", "inside"] as const;
export type ChapterId = (typeof CHAPTERS)[number];

/**
 * Written by the scroll driver, read inside useFrame. Mutated in place, never
 * replaced, so reading it allocates nothing.
 */
export const motion = {
  /** Scroll progress through each chapter, 0..1. */
  progress: [0, 0, 0, 0, 0, 0],
  /** Whether each chapter has been entered (Lite plays each move once on entry). */
  entered: [true, false, false, false, false, false],
  /** Seconds (performance.now / 1000) when the drop was armed; 0 = not yet. */
  dropArmedAt: 0,
  /** Seconds when the last past night was stamped; 0 = never. */
  stampAt: 0,
  /** Pointer position, -1..1, for a gentle parallax on the Full tier. */
  pointerX: 0,
  pointerY: 0,
};

export function resetMotion(): void {
  motion.progress.fill(0);
  motion.entered.fill(false);
  motion.entered[0] = true;
  motion.dropArmedAt = 0;
  motion.stampAt = 0;
}

// Development only: inspect the stage from the browser console (window.__stage.getState()).
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __stage: typeof useStage }).__stage = useStage;
}
