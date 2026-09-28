import { aegean } from "./aegean";
import type { ThemeId, ThemePack } from "./types";
import { vault } from "./vault";

export type { ThemeId, ThemePack } from "./types";

export const THEMES: Record<ThemeId, ThemePack> = { vault, aegean };
export const DEFAULT_THEME: ThemeId = "vault";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

export function themeFor(id: string | null | undefined): ThemePack {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME];
}

/** The CSS for every pack, rendered once in the root layout. The default pack also sits on :root. */
export function themeCss(): string {
  return Object.values(THEMES)
    .map((pack) => {
      const selector = pack.id === DEFAULT_THEME ? `:root, [data-theme="${pack.id}"]` : `[data-theme="${pack.id}"]`;
      const body = Object.entries(pack.vars)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ");
      return `${selector} { ${body} }`;
    })
    .join("\n");
}
