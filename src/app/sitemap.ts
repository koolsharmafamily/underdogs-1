import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { ANONYMOUS } from "@/lib/domain/actor";
import { listPublicNights } from "@/lib/domain/events";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public pages and public nights only. Innercircle nights never appear here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const { upcoming } = await listPublicNights(await getDb(), ANONYMOUS);
  return [
    { url: new URL("/", base).toString() },
    { url: new URL("/nights", base).toString() },
    { url: new URL("/innercircle", base).toString() },
    ...upcoming.map((n) => ({ url: new URL(`/nights/${n.slug}`, base).toString() })),
  ];
}
