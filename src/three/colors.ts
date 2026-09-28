/*
  Colours for the 3D scene, read from the --ic-* tokens on the page at runtime.
  The tokens file stays the only source of colour values.
*/
import { Color } from "three";

export type Token = `--ic-${string}`;

/** A token's CSS value, e.g. "#cbb074". Aegean tokens exist only while data-theme="aegean". */
export function tokenValue(name: Token): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function tokenColor(name: Token, fallback: Token = "--ic-gold-500"): Color {
  const value = tokenValue(name) || tokenValue(fallback);
  return new Color(value);
}

const VAULT_TOKENS = [
  "--ic-void", "--ic-onyx", "--ic-satin-900", "--ic-satin-700", "--ic-satin-500", "--ic-vein",
  "--ic-gold-900", "--ic-gold-700", "--ic-gold-500", "--ic-gold-300", "--ic-gold-100", "--ic-gold-bright",
  "--ic-ivory", "--ic-diamond", "--ic-champagne", "--ic-confetti",
  "--ic-ember-deep", "--ic-ember", "--ic-ember-hot", "--ic-drop", "--ic-drop-deep", "--ic-drop-hi",
] as const;
const AEGEAN_TOKENS = ["--ic-night", "--ic-aegean", "--ic-sky", "--ic-whitewash", "--ic-chrome"] as const;

export type PaletteKey = (typeof VAULT_TOKENS)[number] | (typeof AEGEAN_TOKENS)[number];
export type Palette = Record<PaletteKey, Color>;

/** Every token as a THREE.Color. Aegean tokens fall back to vault ones outside the Aegean theme. */
export function readPalette(): Palette {
  const out = {} as Palette;
  for (const t of VAULT_TOKENS) out[t] = tokenColor(t);
  for (const t of AEGEAN_TOKENS) out[t] = tokenColor(t, "--ic-void");
  return out;
}
