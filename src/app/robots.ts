import type { MetadataRoute } from "next";
import { appUrl, isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // A demo deployment carries invented nights: keep crawlers out entirely.
  if (isDemoMode()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Innercircle pages, coins and private areas are never indexed.
      disallow: ["/innercircle/", "/coin/", "/me", "/crew", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", appUrl()).toString(),
  };
}
