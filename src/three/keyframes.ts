/*
  The coin's keyframe table: one pose at the start and one at the end of each
  home chapter, for wide and narrow screens. The canvas interpolates between
  them with scroll progress (Full), jumps to the end pose on entry (Lite), or
  holds STILL_POSE (Still). Pure data and maths: no three.js.

  Units: x and y are fractions of the view's half-width and half-height, so the
  coin sits in the same place at any size; s multiplies the coin's base size.
*/
import { CHAPTERS } from "./store";

export type Pose = {
  x: number;
  y: number;
  z: number;
  /** Tilt toward the viewer (radians). Negative lays the coin down like a coaster. */
  rx: number;
  rz: number;
  s: number;
  /** Spin on the edge, radians per second. */
  spin: number;
  /** 0 = free spin, 1 = settled face-on. */
  settle: number;
  /** Half-turns: 0 heads, 1 tails, 2 heads again. */
  flip: number;
  /** The champagne flute standing on the coin, 0..1. */
  flute: number;
  /** The six rim notches, 0 hidden .. 1 all lit (they light one by one). */
  notches: number;
  /** Goldie's face waking up, 0..1. */
  awake: number;
};

export const POSE_KEYS = [
  "x", "y", "z", "rx", "rz", "s", "spin", "settle", "flip", "flute", "notches", "awake",
] as const satisfies readonly (keyof Pose)[];

type Layout = { wide: Pose; narrow: Pose };
export type ChapterKeys = { from: Layout; to: Layout; ease: "linear" | "snap" | "smooth" };

const base: Pose = { x: 0.42, y: 0, z: 0, rx: 0, rz: 0, s: 1, spin: 0, settle: 1, flip: 0, flute: 0, notches: 0, awake: 0 };
const pose = (p: Partial<Pose>, from: Pose = base): Pose => ({ ...from, ...p });

// Narrow screens: the coin sits in the upper part, the text below it.
const up: Partial<Pose> = { x: 0, y: 0.5, s: 0.78 };

const vaultFromW = pose({ y: 0.02, rx: 0.04, rz: 0.03, s: 0.96, spin: 0, settle: 1, flip: 0 });
const vaultToW = pose({ rx: 0.14, s: 0.94, spin: 0, settle: 1, flip: 0 });
const headsFromW = pose({ rx: 0.1 });
const headsToW = pose({ rx: 0.1, flip: 1 });
const dropToW = pose({ y: -0.36, rx: -1.22, s: 0.82, flip: 1, flute: 1 });
const circleFromW = pose({ flip: 2 });
const circleToW = pose({ flip: 2, notches: 1 });
const keeperFromW = pose({ x: 0.4, s: 1.05, flip: 2 });
const keeperToW = pose({ x: 0.4, s: 1.05, flip: 2, awake: 1 });
const dockedW = pose({ x: 0.86, y: -0.74, s: 0.32, flip: 2, awake: 1 });

const vaultFromN = pose({ ...up, y: 0.46, rx: 0.04, rz: 0.03, s: 0.86, spin: 0, settle: 1, flip: 0 });
const vaultToN = pose({ ...up, rx: 0.14, spin: 0, settle: 1, flip: 0 });
const headsFromN = pose({ ...up, rx: 0.1 });
const headsToN = pose({ ...up, rx: 0.1, flip: 1 });
const dropToN = pose({ ...up, y: 0.12, rx: -1.22, s: 0.62, flip: 1, flute: 1 });
const circleFromN = pose({ ...up, flip: 2 });
const circleToN = pose({ ...up, flip: 2, notches: 1 });
const keeperFromN = pose({ ...up, flip: 2 });
const keeperToN = pose({ ...up, flip: 2, awake: 1 });
const dockedN = pose({ x: 0.74, y: -0.82, s: 0.28, flip: 2, awake: 1 });

export const KEYFRAMES: Record<(typeof CHAPTERS)[number], ChapterKeys> = {
  // 1. The vault: spins on its edge; scrolling slows the spin and tips it toward you.
  vault: { from: { wide: vaultFromW, narrow: vaultFromN }, to: { wide: vaultToW, narrow: vaultToN }, ease: "linear" },
  // 2. Heads or tails: a scrubbed flip that snaps to each face.
  heads: { from: { wide: headsFromW, narrow: headsFromN }, to: { wide: headsToW, narrow: headsToN }, ease: "snap" },
  // 3. The drop: lands flat like a coaster; the flute rises onto it.
  drop: { from: { wide: headsToW, narrow: headsToN }, to: { wide: dropToW, narrow: dropToN }, ease: "smooth" },
  // 4. Through the circle: back on its face, six rim notches light in turn.
  circle: { from: { wide: circleFromW, narrow: circleFromN }, to: { wide: circleToW, narrow: circleToN }, ease: "linear" },
  // 5. The keeper: the face wakes up as Goldie.
  keeper: { from: { wide: keeperFromW, narrow: keeperFromN }, to: { wide: keeperToW, narrow: keeperToN }, ease: "smooth" },
  // 6. Been inside: the coin docks bottom-right as you scroll on.
  inside: { from: { wide: keeperToW, narrow: keeperToN }, to: { wide: dockedW, narrow: dockedN }, ease: "smooth" },
};

/** Reduced motion: the coin rests face-on and nothing moves. */
export const STILL_POSE: Layout = { wide: pose({ s: 1 }), narrow: pose({ ...up }) };

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function easeProgress(ease: ChapterKeys["ease"], p: number): number {
  if (ease === "snap") return smoothstep(0.3, 0.7, p); // rests on heads, flips through the middle, rests on tails
  if (ease === "smooth") return smoothstep(0, 1, p);
  return Math.min(1, Math.max(0, p));
}

/** Which chapter drives the coin: the last one entered. */
export function activeChapter(entered: readonly boolean[]): number {
  for (let i = entered.length - 1; i > 0; i--) if (entered[i]) return i;
  return 0;
}

/** Writes the pose for chapter i at progress p into `out` (no allocation). */
export function samplePose(i: number, p: number, narrow: boolean, out: Pose): Pose {
  const keys = KEYFRAMES[CHAPTERS[i]];
  const a = narrow ? keys.from.narrow : keys.from.wide;
  const b = narrow ? keys.to.narrow : keys.to.wide;
  const t = easeProgress(keys.ease, p);
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

export function copyPose(src: Pose, out: Pose): Pose {
  for (const k of POSE_KEYS) out[k] = src[k];
  return out;
}

export function emptyPose(): Pose {
  return { ...base };
}
