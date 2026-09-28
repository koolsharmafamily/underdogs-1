/*
  Applies the bundled migrations (migrations.gen.ts) once, under an advisory
  lock, so several serverless instances starting together cannot race.
*/
import { sql } from "drizzle-orm";
import { migrations } from "./migrations.gen";
import type { Db } from "./types";

const MIGRATION_LOCK = 72_401; // arbitrary, app-wide advisory lock ids live here
export const SEED_LOCK = 72_402;

type AppliedRow = { tag: string };

export async function migrate(db: Db): Promise<string[]> {
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`select pg_advisory_xact_lock(${MIGRATION_LOCK})`));
    await tx.execute(
      sql.raw(`create table if not exists ic_migrations (
        tag text primary key,
        applied_at timestamptz not null default now()
      )`),
    );
    const result = await tx.execute(sql.raw(`select tag from ic_migrations`));
    const applied = new Set(rowsOf<AppliedRow>(result).map((r) => r.tag));
    const ran: string[] = [];
    for (const m of migrations) {
      if (applied.has(m.tag)) continue;
      for (const statement of m.statements) await tx.execute(sql.raw(statement));
      await tx.execute(sql`insert into ic_migrations (tag) values (${m.tag})`);
      ran.push(m.tag);
    }
    return ran;
  });
}

/** PGlite returns { rows }, postgres-js returns the rows array itself. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
