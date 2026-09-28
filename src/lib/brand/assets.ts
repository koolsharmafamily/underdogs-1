import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Literal paths only: dynamic ones make the file tracer ship the whole project.

let logo: Promise<string> | undefined;
/** Logo.jpg as a data URL, for ImageResponse (OG images, icons). */
export function logoDataUrl(): Promise<string> {
  logo ??= readFile(join(process.cwd(), "public", "brand", "logo.jpg")).then(
    (b) => `data:image/jpeg;base64,${b.toString("base64")}`,
  );
  return logo;
}

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 600; style: "normal" }[]> | undefined;
/** Cinzel and EB Garamond as WOFF (OFL, from @fontsource), for ImageResponse. */
export function ogFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "node_modules", "@fontsource", "cinzel", "files", "cinzel-latin-600-normal.woff")),
    readFile(join(process.cwd(), "node_modules", "@fontsource", "eb-garamond", "files", "eb-garamond-latin-500-normal.woff")),
  ]).then(([cinzel, garamond]) => [
    { name: "Cinzel", data: cinzel, weight: 600 as const, style: "normal" as const },
    { name: "EB Garamond", data: garamond, weight: 500 as const, style: "normal" as const },
  ]);
  return fonts;
}
