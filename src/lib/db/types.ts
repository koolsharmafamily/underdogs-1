import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Schema = typeof schema;

/**
 * The database handle every domain function receives. Both drivers (PGlite and
 * postgres-js) are PgDatabase subclasses, and a transaction is one too, so a
 * domain function can be handed either the root handle or an open transaction.
 */
export type Db = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
