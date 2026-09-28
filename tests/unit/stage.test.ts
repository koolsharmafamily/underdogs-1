import { describe, expect, it } from "vitest";
import { KEYFRAMES, STILL_POSE, activeChapter, easeProgress, emptyPose, samplePose } from "@/three/keyframes";
import { CHAPTERS } from "@/three/store";
import { chooseTier, type TierSignals } from "@/three/tier";

const desktop: TierSignals = {
  webgl: true,
  reducedMotion: false,
  renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)",
  cores: 12,
  memoryGb: 8,
  saveData: false,
  touch: false,
  shortSide: 1080,
};

describe("tier choice", () => {
  it("gives a capable desktop the Full tier", () => expect(chooseTier(desktop)).toBe("full"));
  it("falls back to HTML without WebGL", () => expect(chooseTier({ ...desktop, webgl: false })).toBe("none"));
  it("respects reduced motion before anything else but WebGL", () =>
    expect(chooseTier({ ...desktop, reducedMotion: true })).toBe("still"));
  it("gives slow GPUs, small memory, data saver and 4-core phones the Lite tier", () => {
    expect(chooseTier({ ...desktop, renderer: "Mali-G52 MC2" })).toBe("lite");
    expect(chooseTier({ ...desktop, renderer: "Google SwiftShader" })).toBe("lite");
    expect(chooseTier({ ...desktop, memoryGb: 2 })).toBe("lite");
    expect(chooseTier({ ...desktop, saveData: true })).toBe("lite");
    expect(chooseTier({ ...desktop, cores: 4, touch: true })).toBe("lite");
  });
  it("keeps a recent phone on Full", () =>
    expect(chooseTier({ ...desktop, renderer: "Adreno (TM) 740", cores: 8, touch: true, memoryGb: 8 })).toBe("full"));
});

describe("keyframes", () => {
  it("defines both layouts for all six chapters", () => {
    expect(Object.keys(KEYFRAMES)).toEqual([...CHAPTERS]);
    for (const c of CHAPTERS) {
      for (const layout of ["wide", "narrow"] as const) {
        for (const end of ["from", "to"] as const) {
          const p = KEYFRAMES[c][end][layout];
          for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it("chains the scrubbed chapters so the coin never jumps", () => {
    const at = (i: number, p: number) => samplePose(i, p, false, emptyPose());
    // heads starts where the vault left it settled, and the drop starts on tails
    expect(at(2, 0).flip).toBe(at(1, 1).flip);
    expect(at(2, 0).x).toBe(at(1, 1).x);
    expect(at(5, 0)).toEqual(at(4, 1));
  });

  it("starts settled on heads in the vault, rests on each face in heads or tails, and stands the flute in the drop", () => {
    const pose = emptyPose();
    expect(samplePose(0, 0, false, pose)).toMatchObject({ spin: 0, settle: 1, flip: 0 });
    expect(samplePose(0, 1, false, pose)).toMatchObject({ spin: 0, settle: 1, flip: 0 });
    expect(samplePose(1, 0.2, false, pose).flip).toBe(0);
    expect(samplePose(1, 0.8, false, pose).flip).toBe(1);
    expect(samplePose(2, 1, true, pose).flute).toBe(1);
    expect(samplePose(3, 0.5, false, pose).notches).toBeCloseTo(0.5);
  });

  it("docks the coin small in the bottom-right corner", () => {
    const docked = samplePose(5, 1, false, emptyPose());
    expect(docked.x).toBeGreaterThan(0.7);
    expect(docked.y).toBeLessThan(-0.6);
    expect(docked.s).toBeLessThan(0.4);
  });

  it("holds a face-on still pose with nothing moving", () => {
    for (const p of [STILL_POSE.wide, STILL_POSE.narrow]) {
      expect(p).toMatchObject({ spin: 0, settle: 1, flip: 0, flute: 0, rx: 0 });
    }
  });

  it("picks the last chapter entered", () => {
    expect(activeChapter([true, false, false, false, false, false])).toBe(0);
    expect(activeChapter([true, true, true, false, false, false])).toBe(2);
    expect(easeProgress("snap", 0.1)).toBe(0);
    expect(easeProgress("snap", 0.9)).toBe(1);
  });
});
