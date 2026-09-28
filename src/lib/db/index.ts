/*
  The database handle. PGlite (embedded Postgres in .data/pglite) by default;
  postgres-js when DATABASE_URL is set (Neon or the Supabase pooler).
  Migrations and the seed run once, on first use.
*/
import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { databaseUrl, isServerless } from "../env";
import { migrate } from "./migrate";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";
import type { Db } from "./types";

export type { Db } from "./types";

export type DbHandle = { db: Db; driver: "pglite" | "postgres"; persistent: boolean; close: () => Promise<void> };

/** Where the local PGlite files live; `memory` for tests and read-only hosts. */
export type DbTarget = { url: string } | { dataDir: string } | "memory";

export function defaultTarget(): DbTarget {
  const url = databaseUrl();
  if (url) return { url };
  // Serverless hosts cannot write .data/: fall back to per-instance memory (see DEMO_NOTES.md).
  if (isServerless()) return "memory";
  return { dataDir: join(process.cwd(), ".data", "pglite") };
}

export async function openDb(target: DbTarget): Promise<DbHandle> {
  if (target !== "memory" && "url" in target) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    // prepare:false works with transaction-mode poolers (Supabase, Neon).
    const client = postgres(target.url, { prepare: false, max: isServerless() ? 3 : 10 });
    const db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Db;
    return { db, driver: "postgres", persistent: true, close: () => client.end() };
  }
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  if (target !== "memory") mkdirSync(target.dataDir, { recursive: true });
  // PGlite is one connection; its own lock keeps a transaction from interleaving with other queries.
  const client = target === "memory" ? await PGlite.create() : await PGlite.create(target.dataDir);
  const db = drizzle({ client, schema, casing: "snake_case" }) as unknown as Db;
  return { db, driver: "pglite", persistent: target !== "memory", close: () => client.close() };
}

/** Opens, migrates and seeds. Used by the app (via getDb) and by tests. */
export async function openReadyDb(target: DbTarget): Promise<DbHandle> {
  const handle = await openDb(target);
  await migrate(handle.db);
  await seedIfEmpty(handle.db);
  return handle;
}

declare global {
  var __innercircleDb: Promise<DbHandle> | undefined;
}

/** The app-wide handle, kept on globalThis so dev hot reloads reuse one PGlite instance. */
export function getDbHandle(): Promise<DbHandle> {
  globalThis.__innercircleDb ??= openReadyDb(defaultTarget()).catch((error) => {
    globalThis.__innercircleDb = undefined;
    throw error;
  });
  return globalThis.__innercircleDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}
