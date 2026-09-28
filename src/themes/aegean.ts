import type { ThemePack } from "./types";

/*
  La Dolce Vita: Santorini after dark, 80s chrome. Surfaces and borders are
  mixed from the five Aegean tokens; no new colours. The coin stays gold.
*/
export const aegean: ThemePack = {
  id: "aegean",
  name: "Aegean",
  look: "Santorini after dark, 80s chrome.",
  vars: {
    "--bg": "var(--ic-night)",
    "--bg-deep": "color-mix(in oklab, var(--ic-night) 60%, var(--ic-void))",
    "--surface": "color-mix(in oklab, var(--ic-night) 84%, var(--ic-aegean))",
    "--surface-raised": "color-mix(in oklab, var(--ic-night) 64%, var(--ic-aegean))",
    "--border": "color-mix(in oklab, var(--ic-aegean) 55%, var(--ic-night))",
    "--rule": "color-mix(in oklab, var(--ic-chrome) 55%, var(--ic-night))",
    "--text": "var(--ic-whitewash)",
    "--text-dim": "color-mix(in oklab, var(--ic-whitewash) 80%, var(--ic-sky))",
    "--heading": "var(--ic-chrome)",
    "--accent": "var(--ic-sky)",
    "--accent-strong": "var(--ic-whitewash)",
    "--accent-muted": "color-mix(in oklab, var(--ic-sky) 75%, var(--ic-whitewash))",
    "--on-accent": "var(--ic-night)",
    "--focus": "var(--ic-sky)",
    "--drop": "var(--ic-drop)",
    "--drop-text": "var(--ic-drop-hi)",
    "--glow": "var(--ic-aegean)",
    "--metal": "var(--ic-gold-metal)",
    "--sheen":
      "linear-gradient(160deg, var(--ic-void) 0%, var(--ic-night) 38%, color-mix(in oklab, var(--ic-aegean) 55%, var(--ic-night)) 50%, var(--ic-night) 62%, var(--ic-void) 100%)",
    "--night-title-font": "var(--ff-night-aegean)",
  },
  scene: {
    backdrop: "aegean-night",
    fog: "--ic-night",
    lightRig: "aegean",
    particles: "stars",
    props: ["statue-mirrorball", "chrome"],
  },
};
