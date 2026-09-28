/*
  Picks the 3D quality tier in the browser. No three.js here: this runs before
  the 3D chunk is fetched, and decides whether to fetch it at all.

  - none:  no WebGL.
  - still: prefers-reduced-motion.
  - lite:  a slow GPU, few cores, little memory, or data saver.
  - full:  everything else. PerformanceMonitor can still step Full down to Lite.
*/
import { TIERS, type Tier } from "./store";

const OVERRIDE_KEY = "ic_tier";

/** GPUs and software renderers that should not get bloom-like effects or scrubbing. */
const SLOW_GPU = /(mali-[4t]\d{2}|mali-g(31|51|52|57)|adreno \(tm\) [3-5]\d{2}|powervr|swiftshader|llvmpipe|software|intel\(r\) hd graphics [2-5]\d{2,3})/i;

export type TierSignals = {
  webgl: boolean;
  reducedMotion: boolean;
  renderer: string;
  cores: number;
  memoryGb: number | null;
  saveData: boolean;
  touch: boolean;
  shortSide: number;
};

/** The decision itself, pure so it can be tested. */
export function chooseTier(s: TierSignals): Tier {
  if (!s.webgl) return "none";
  if (s.reducedMotion) return "still";
  if (s.saveData) return "lite";
  if (SLOW_GPU.test(s.renderer)) return "lite";
  if (s.memoryGb !== null && s.memoryGb <= 3) return "lite";
  if (s.cores > 0 && s.cores <= 4 && s.touch) return "lite";
  return "full";
}

export function readSignals(): TierSignals {
  let webgl = false;
  let renderer = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      webgl = true;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl = false;
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    renderer,
    cores: nav.hardwareConcurrency ?? 0,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    saveData: Boolean(nav.connection?.saveData),
    touch: window.matchMedia("(pointer: coarse)").matches,
    shortSide: Math.min(window.screen.width, window.screen.height),
  };
}

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

/** The demo panel's override, from ?tier= (which also saves it) or local storage. */
export function readTierOverride(): Tier | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("tier");
    if (fromUrl === "auto") {
      window.localStorage.removeItem(OVERRIDE_KEY);
      return null;
    }
    if (isTier(fromUrl)) {
      window.localStorage.setItem(OVERRIDE_KEY, fromUrl);
      return fromUrl;
    }
    const saved = window.localStorage.getItem(OVERRIDE_KEY);
    return isTier(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function saveTierOverride(tier: Tier | null): void {
  try {
    if (tier) window.localStorage.setItem(OVERRIDE_KEY, tier);
    else window.localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // Storage can be blocked; the override then lasts for this page only.
  }
}
