import Link from "next/link";
import { Lockup } from "../brand/Lockup";

const NAV = [
  { href: "/nights", label: "Nights" },
  { href: "/innercircle", label: "Innercircle" },
  { href: "/me", label: "Your coin" },
  { href: "/crew", label: "Crew" },
] as const;

export function SiteHeader() {
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
        <nav aria-label="Main">
          <ul className="flex items-center text-sm sm:gap-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full px-2 whitespace-nowrap text-text-dim transition-colors hover:text-accent sm:px-3"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
