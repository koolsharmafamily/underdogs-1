/*
  A theme pack is a night's world: CSS variables (all built from --ic-* tokens),
  one display face for the night's title, and the 3D environment (step 2).
  The coin never changes between packs.
*/
export type ThemeId = "vault" | "aegean";

/** The semantic variables every component uses. Values must reference --ic-* tokens only. */
export type SemanticVar =
  | "--bg"
  | "--bg-deep"
  | "--surface"
  | "--surface-raised"
  | "--border"
  | "--rule"
  | "--text"
  | "--text-dim"
  | "--heading"
  | "--accent"
  | "--accent-strong"
  | "--accent-muted"
  | "--on-accent"
  | "--focus"
  | "--drop"
  | "--drop-text"
  | "--glow"
  | "--metal"
  | "--sheen"
  | "--night-title-font";

export type ThemePack = {
  id: ThemeId;
  name: string;
  /** One line for the demo panel. */
  look: string;
  vars: Record<SemanticVar, string>;
  /** The 3D world, read by the canvas in step 2. Colours are token names, resolved in the browser. */
  scene: {
    backdrop: "satin" | "aegean-night";
    fog: `--ic-${string}`;
    lightRig: "vault" | "aegean";
    particles: "confetti" | "stars";
    props: ("firelight" | "marble" | "statue-mirrorball" | "chrome")[];
  };
};
