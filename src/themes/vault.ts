import type { ThemePack } from "./types";

/** The launch: black satin and marble, copper firelight, gold confetti. */
export const vault: ThemePack = {
  id: "vault",
  name: "The vault",
  look: "Black satin and marble, copper firelight.",
  vars: {
    "--bg": "var(--ic-void)",
    "--bg-deep": "var(--ic-void)",
    "--surface": "var(--ic-satin-900)",
    "--surface-raised": "var(--ic-satin-700)",
    "--border": "var(--ic-satin-700)",
    "--rule": "var(--ic-gold-700)",
    "--text": "var(--ic-ivory)",
    "--text-dim": "var(--ic-ivory-dim)",
    "--heading": "var(--ic-gold-300)",
    "--accent": "var(--ic-gold-300)",
    "--accent-strong": "var(--ic-gold-100)",
    "--accent-muted": "var(--ic-gold-500)",
    "--on-accent": "var(--ic-void)",
    "--focus": "var(--ic-gold-100)",
    "--drop": "var(--ic-drop)",
    "--drop-text": "var(--ic-drop-hi)",
    "--glow": "var(--ic-ember)",
    "--metal": "var(--ic-gold-metal)",
    "--sheen": "var(--ic-satin-sheen)",
    "--night-title-font": "var(--ff-display)",
  },
  scene: {
    backdrop: "satin",
    fog: "--ic-void",
    lightRig: "vault",
    particles: "confetti",
    props: ["firelight", "marble"],
  },
};
