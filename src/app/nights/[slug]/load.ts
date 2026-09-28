import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getActor } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { isDomainError } from "@/lib/domain/errors";
import { getPublicNight } from "@/lib/domain/events";

/** One public night, shared by the page and its metadata within a request. */
export const loadPublicNight = cache(async (slug: string) => {
  const db = await getDb();
  try {
    return await getPublicNight(db, await getActor(db), { slug });
  } catch (error) {
    if (isDomainError(error, "not_found")) notFound();
    throw error;
  }
});
