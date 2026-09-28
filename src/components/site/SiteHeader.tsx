"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lockup } from "../brand/Lockup";

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly homeHash?: string;
};

const NAV: readonly NavItem[] = [
  { href: "/nights", label: "Nights" },
  { href: "/innercircle", label: "Innercircle" },
  { href: "/concierge", homeHash: "#concierge", label: "Concierge" },
  { href: "/me", label: "Your coin" },
  { href: "/crew", label: "Crew" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="relative z-10 border-b border-border/60">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-20 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-accent"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-sm p-1" aria-label="Underdogs Innercircle, home">
          <Lockup />
        </Link>
        <nav aria-label="Main" className="overflow-x-auto scrollbar-none">
          <ul className="flex items-center text-xs sm:text-sm sm:gap-1.5">
            {NAV.map((item) => {
              const targetHref = item.homeHash && isHome ? item.homeHash : item.href;
              const isActive = pathname === item.href;
              return (
                <li key={item.label}>
                  <Link
                    href={targetHref}
                    title={item.label === "Concierge" ? "Goldie · AI Concierge" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full px-2 sm:px-3 whitespace-nowrap transition-colors hover:text-accent ${
                      isActive ? "text-accent font-medium" : "text-text-dim"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
