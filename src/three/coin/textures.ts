/*
  Canvas-drawn textures for the coin. The heads side is Logo.jpg itself (the
  ring lettering is logo artwork and is never retyped in a font). The tails
  side is an original octagram mount drawn from the launch post's motif.
*/
import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { type Token, tokenValue } from "../colors";

/** Where the coin sits inside Logo.jpg (1024 × 1024), measured from the file. */
export const LOGO_COIN = { cx: 510, cy: 518, r: 391 } as const;
/** Radii inside the coin, as fractions of its radius (measured from Logo.jpg). */
export const LOGO_FACE = {
  onyx: 0.555,
  eyeX: 0.19,
  eyeY: 0.18,
  smileTop: -0.09,
  tongueY: -0.29,
} as const;

/**
 * Height and alpha maps are data, not colour: a grey level is a height, a mask
 * value is coverage. These two helpers are the only literal colour syntax here;
 * every visible colour comes from the tokens.
 */
const level = (v: number) => { const n = Math.round(Math.min(1, Math.max(0, v)) * 255); return `rgb(${n},${n},${n})`; };
const mask = (a: number) => `rgba(255,255,255,${a})`;

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

function finish(t: Texture, srgb: boolean, anisotropy = 8): Texture {
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export type FaceTextures = { map: Texture; bump: Texture };

/** The heads side: Logo.jpg cropped to the coin, plus a luminance bump map for the engraving. */
export async function loadHeadsTextures(size = 1024): Promise<FaceTextures> {
  const img = await loadImage("/brand/logo.jpg");
  const { cx, cy, r } = LOGO_COIN;
  const { c, ctx } = canvas(size);
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2, 0, 0, size, size);

  const bump = canvas(size);
  bump.ctx.filter = "grayscale(1) contrast(1.6) brightness(1.1)";
  bump.ctx.drawImage(c, 0, 0);
  return {
    map: finish(new CanvasTexture(c), true),
    bump: finish(new CanvasTexture(bump.c), false),
  };
}

/** The Ionic column, as the lockup draws it (same path data as IonicColumn.tsx, 28 × 32 box). */
const COLUMN_PATHS = [
  "M3.5 3.5h21",
  "M7.5 5.2h13M8 7.4h12",
  "M7.5 5.2c-2.6 0-4 1.2-4 2.7 0 1.3 1 2.2 2.2 2.2 1 0 1.8-.7 1.8-1.6 0-.8-.6-1.3-1.3-1.3-.6 0-1 .4-1 .9",
  "M20.5 5.2c2.6 0 4 1.2 4 2.7 0 1.3-1 2.2-2.2 2.2-1 0-1.8-.7-1.8-1.6 0-.8.6-1.3 1.3-1.3.6 0 1 .4 1 .9",
  "M9 9.6h10M9.5 10.4v15.2M18.5 10.4v15.2",
  "M12 11.2v13.6M14 11.2v13.6M16 11.2v13.6",
  "M8 26.2h12M6.5 28h15M4.5 30h19",
];

function fontFamily(variable: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v || fallback;
}

/** Text along an arc, centred on `angle` (radians, canvas convention: 0 = right, -π/2 = top). */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, radius: number, angle: number, spacing: number, inside: boolean) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let a = angle + (inside ? 1 : -1) * (total / radius) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((ch, i) => {
    const w = widths[i];
    a += (inside ? -1 : 1) * (w / radius) / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + (inside ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += (inside ? -1 : 1) * (w / radius) / 2;
  });
}

export type TailsOptions = { engraving?: string; serial?: string };

/**
 * The tails side, drawn twice from one recipe: in colour (map) and as a height
 * field (bump), so what looks raised is raised.
 */
function drawTails(ctx: CanvasRenderingContext2D, size: number, mode: "color" | "height", opts: TailsOptions) {
  const c = size / 2;
  const col = (t: Token) => tokenValue(t);
  const raised = mode === "height" ? level(1) : col("--ic-gold-100");
  const low = mode === "height" ? level(0.2) : col("--ic-gold-900");

  // Outer brushed gold ring with deep onyx inner field, matching the Heads side contrast and font champagne-gold (--ic-gold-metal).
  if (mode === "color") {
    const g = ctx.createRadialGradient(c * 0.68, c * 0.55, size * 0.05, c, c, c);
    g.addColorStop(0, col("--ic-gold-100"));
    g.addColorStop(0.48, col("--ic-gold-300"));
    g.addColorStop(0.82, col("--ic-gold-500"));
    g.addColorStop(1, col("--ic-gold-700"));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = level(0.55);
  }
  ctx.fillRect(0, 0, size, size);

  // Deep black onyx recessed inner field inside the outer gold ring.
  ctx.fillStyle = mode === "color" ? col("--ic-void") : level(0.12);
  ctx.beginPath();
  ctx.arc(c, c, c * 0.74, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = mode === "color" ? 0.08 : 0.12;
  for (let r = 6; r < c; r += 2.2) {
    ctx.strokeStyle = (r * 7) % 3 < 1.4 ? (mode === "color" ? col("--ic-gold-900") : level(0)) : raised;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Inner border ring, just inside the rim.
  ctx.strokeStyle = low;
  ctx.lineWidth = size * 0.006;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  // Gold bezel around the black onyx center field.
  ctx.strokeStyle = raised;
  ctx.lineWidth = size * 0.008;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.74, 0, Math.PI * 2);
  ctx.stroke();

  // The octagram mount: two squares, 45° apart, each a double rule.
  const star = (rad: number, rot: number) => {
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = rot + (k * Math.PI) / 2;
      const x = c + Math.cos(a) * rad;
      const y = c + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  const R = c * 0.68;
  ctx.lineJoin = "miter";
  for (const rot of [-Math.PI / 4, 0]) {
    ctx.fillStyle = mode === "color" ? col("--ic-onyx") : level(0.22);
    ctx.globalAlpha = 0.75;
    star(R, rot);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = raised;
    ctx.lineWidth = size * 0.007;
    star(R, rot);
    ctx.stroke();
    ctx.lineWidth = size * 0.004;
    star(R * 0.9, rot);
    ctx.stroke();
  }

  // Pavé: small stones along the star's edges.
  ctx.fillStyle = mode === "color" ? col("--ic-diamond") : level(1);
  for (const rot of [-Math.PI / 4, 0]) {
    for (let k = 0; k < 4; k++) {
      const a0 = rot + (k * Math.PI) / 2;
      const a1 = a0 + Math.PI / 2;
      const x0 = c + Math.cos(a0) * R * 0.95;
      const y0 = c + Math.sin(a0) * R * 0.95;
      const x1 = c + Math.cos(a1) * R * 0.95;
      const y1 = c + Math.sin(a1) * R * 0.95;
      for (let s = 1; s < 16; s++) {
        const t = s / 16;
        ctx.beginPath();
        ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size * 0.0042, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // The medallion and the Ionic column at the centre: deep black onyx disc with gleaming gold column.
  const m = c * 0.36;
  ctx.fillStyle = mode === "color" ? col("--ic-void") : level(0.25);
  ctx.beginPath();
  ctx.arc(c, c, m, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = raised;
  ctx.lineWidth = size * 0.008;
  ctx.stroke();
  ctx.lineWidth = size * 0.003;
  ctx.beginPath();
  ctx.arc(c, c, m * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  const colScale = (m * 1.1) / 32;
  ctx.translate(c - 14 * colScale, c - 16 * colScale - m * 0.1);
  ctx.scale(colScale, colScale);
  ctx.strokeStyle = mode === "color" ? col("--ic-gold-100") : level(1);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const d of COLUMN_PATHS) ctx.stroke(new Path2D(d));
  ctx.restore();

  // Lettering: INNERCIRCLE over the top, the year (or the holder's name) underneath.
  const display = fontFamily("--font-cinzel", "serif");
  ctx.fillStyle = mode === "color" ? col("--ic-gold-900") : level(1);
  ctx.font = `600 ${Math.round(size * 0.055)}px ${display}`;
  arcText(ctx, "INNERCIRCLE", c, c, c * 0.83, -Math.PI / 2, size * 0.012, false);
  ctx.font = `600 ${Math.round(size * 0.042)}px ${display}`;
  arcText(ctx, opts.engraving ?? "MMXXVI", c, c, c * 0.83, Math.PI / 2, size * 0.014, true);
  if (opts.serial) {
    ctx.fillStyle = mode === "color" ? col("--ic-gold-300") : level(1);
    ctx.font = `600 ${Math.round(size * 0.03)}px ${display}`;
    ctx.textAlign = "center";
    ctx.fillText(opts.serial, c, c + m * 0.72);
  }
}

export async function makeTailsTextures(opts: TailsOptions = {}, size = 1024): Promise<FaceTextures> {
  const display = fontFamily("--font-cinzel", "serif");
  try {
    await document.fonts.load(`600 40px ${display}`);
  } catch {
    // Falls back to the next serif; the coin still draws.
  }
  const color = canvas(size);
  drawTails(color.ctx, size, "color", opts);
  const height = canvas(size);
  drawTails(height.ctx, size, "height", opts);
  height.ctx.filter = "blur(1px)";
  height.ctx.drawImage(height.c, 0, 0);
  return { map: finish(new CanvasTexture(color.c), true), bump: finish(new CanvasTexture(height.c), false) };
}

/** Milled edge: fine vertical ridges, repeated around the rim. */
export function makeEdgeBump(): Texture {
  const { c, ctx } = canvas(256, 8);
  for (let x = 0; x < 256; x++) {
    const v = Math.round(128 + 110 * Math.sin((x / 256) * Math.PI * 2 * 8));
    ctx.fillStyle = level(v / 255);
    ctx.fillRect(x, 0, 1, 8);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.repeat.set(24, 1);
  return finish(t, false, 4);
}

/** A four-point star glint (white on transparent), for sprites. */
export function makeGlintTexture(): Texture {
  const size = 128;
  const { c, ctx } = canvas(size);
  const h = size / 2;
  const core = ctx.createRadialGradient(h, h, 0, h, h, h * 0.35);
  core.addColorStop(0, mask(1));
  core.addColorStop(1, mask(0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = mask(0.9);
  for (const [w, l] of [
    [3, h],
    [1.2, h * 0.6],
  ]) {
    ctx.save();
    ctx.translate(h, h);
    for (let k = 0; k < (l === h ? 2 : 2); k++) {
      ctx.rotate(l === h ? (k * Math.PI) / 2 : Math.PI / 4 + (k * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(-l, 0);
      ctx.quadraticCurveTo(0, -w, l, 0);
      ctx.quadraticCurveTo(0, w, -l, 0);
      ctx.fill();
    }
    ctx.restore();
  }
  return finish(new CanvasTexture(c), false, 1);
}

/** A soft radial glow (white on transparent): the halo that stands in for bloom. */
export function makeHaloTexture(): Texture {
  const size = 256;
  const { c, ctx } = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, mask(0.9));
  g.addColorStop(0.35, mask(0.35));
  g.addColorStop(1, mask(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(new CanvasTexture(c), false, 1);
}
