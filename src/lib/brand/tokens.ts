/*
  Reads colour values straight from innercircle-tokens.css for places CSS
  variables cannot reach (server-rendered OG images and icons). The CSS file
  stays the single source of truth; nothing here repeats a hex value.
*/
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type TokenName = `--ic-${string}`;
type Tokens = { root: Record<string, string>; aegean: Record<string, string> };

let cached: Promise<Tokens> | undefined;

function parse(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--ic-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) out[m[1]] = m[2];
  return out;
}

export function loadTokens(): Promise<Tokens> {
  cached ??= readFile(join(process.cwd(), "src/styles/innercircle-tokens.css"), "utf8").then((css) => {
    const [root, aegean = ""] = css.split('[data-theme="aegean"]');
    return { root: parse(root), aegean: parse(aegean) };
  });
  return cached;
}

/** One token's hex value, e.g. token("--ic-onyx"). Throws if the token is missing. */
export async function token(name: TokenName): Promise<string> {
  const { root, aegean } = await loadTokens();
  const value = root[name] ?? aegean[name];
  if (!value) throw new Error(`Unknown token ${name}`);
  return value;
}

/** Many tokens at once: tokens(["--ic-onyx", "--ic-gold-300"]) → { "--ic-onyx": "#…", … }. */
export async function tokens<const N extends TokenName>(names: readonly N[]): Promise<Record<N, string>> {
  const entries = await Promise.all(names.map(async (n) => [n, await token(n)] as const));
  return Object.fromEntries(entries) as Record<N, string>;
}
