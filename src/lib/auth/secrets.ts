/*
  Server secrets. An env var always wins. Without one, in demo mode, a random
  secret is generated once and kept in demo_settings, so sessions survive
  restarts locally and are shared by every instance on Vercel. Outside demo
  mode a missing secret is an error.
*/
import { eq } from "drizzle-orm";
import { randomToken } from "../crypto";
import { demoSettings } from "../db/schema";
import type { Db } from "../db/types";
import { isDemoMode } from "../env";

export type SecretName = "session" | "cron";

const ENV_NAMES: Record<SecretName, string> = {
  session: "SESSION_SECRET",
  cron: "CRON_SECRET",
};

const cache = new Map<SecretName, string>();

export async function getSecret(db: Db, name: SecretName): Promise<string> {
  const fromEnv = process.env[ENV_NAMES[name]]?.trim();
  if (fromEnv) return fromEnv;
  const cached = cache.get(name);
  if (cached) return cached;
  if (!isDemoMode()) throw new Error(`${ENV_NAMES[name]} must be set when DEMO_MODE is off.`);

  const key = `secret:${name}`;
  await db.insert(demoSettings).values({ key, value: randomToken(32) }).onConflictDoNothing();
  const [row] = await db.select({ value: demoSettings.value }).from(demoSettings).where(eq(demoSettings.key, key));
  const value = String(row.value);
  cache.set(name, value);
  return value;
}

/** Tests only: forget cached secrets (for example after swapping databases). */
export function clearSecretCacheForTests(): void {
  cache.clear();
}
