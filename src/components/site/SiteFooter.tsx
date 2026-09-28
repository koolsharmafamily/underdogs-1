import { INSTAGRAM_INNERCIRCLE, INSTAGRAM_UNDERDOGS, ORGANISER, SORTMYSCENE_ORGANISER_URL } from "@/lib/site";
import { DemoTag } from "../brand/Frame";
import { Lockup } from "../brand/Lockup";

const LINKS = [
  { href: INSTAGRAM_INNERCIRCLE, label: "@underdogsinnercircle" },
  { href: INSTAGRAM_UNDERDOGS, label: "@underdogs_nagpur" },
  { href: SORTMYSCENE_ORGANISER_URL, label: "Public nights on SortMyScene" },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 text-center sm:px-6">
        <Lockup size="md" year="MMXXVI" />
        <p className="font-serif text-lg text-text-dim italic">Heads: the rage. Tails: the room.</p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-accent-muted underline-offset-4 hover:text-accent hover:underline" rel="noopener noreferrer" target="_blank">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-center gap-2 text-xs text-text-dim">
          <DemoTag label="Demo build" />
          <p className="max-w-md">
            A working demo for the {ORGANISER} crew. Anything invented is labelled Demo. No money moves and no messages are sent.
          </p>
          <p>{ORGANISER}, Nagpur</p>
        </div>
      </div>
    </footer>
  );
}
