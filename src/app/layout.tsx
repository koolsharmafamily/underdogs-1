import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { DemoPanel } from "@/components/demo/DemoPanel";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { THEME_COOKIE } from "@/lib/cookies";
import { appUrl, isDemoMode } from "@/lib/env";
import { SITE_LINE, SITE_NAME } from "@/lib/site";
import { CanvasHost } from "@/three/CanvasHost";
import { isThemeId, themeCss } from "@/themes";
import { fontVariables } from "./fonts";
import "./globals.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: appUrl(),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: SITE_LINE,
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, type: "website", locale: "en_IN" },
    // A demo deployment carries invented nights: keep it out of search results.
    robots: isDemoMode() ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read theme override cookie if present; avoid blocking root layout HTML streaming on cold database migrations.
  const cookieOverride = (await cookies()).get(THEME_COOKIE)?.value ?? null;
  const override = isDemoMode() && isThemeId(cookieOverride) ? cookieOverride : null;
  const theme = override ?? "vault";

  return (
    <html lang="en-IN" data-theme={theme} className={fontVariables}>
      <head>
        <style id="theme-packs" dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <CanvasHost />
        <SiteHeader />
        <main id="main" className="relative z-10 flex-1">
          {children}
        </main>
        <SiteFooter />
        {isDemoMode() ? <DemoPanel themeOverride={override} /> : null}
      </body>
    </html>
  );
}
