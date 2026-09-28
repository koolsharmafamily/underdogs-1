import { IonicColumn } from "./IonicColumn";

/**
 * The secondary lockup: "INNERCIRCLE" in widely spaced serif capitals under a
 * small Ionic column, as on their teaser posts. `year` adds the Roman-numeral line.
 */
export function Lockup({ size = "sm", year }: { size?: "sm" | "md"; year?: string }) {
  const md = size === "md";
  return (
    <span className="inline-flex flex-col items-center text-accent" aria-label="Innercircle">
      <IonicColumn className={md ? "h-9 w-8" : "h-6 w-5"} />
      <span
        aria-hidden
        className={`font-display tracking-lockup ${md ? "mt-2 text-lg" : "mt-1 text-[0.7rem]"} -mr-[0.42em] leading-none`}
      >
        INNERCIRCLE
      </span>
      {year ? (
        <span aria-hidden className="mt-1.5 font-display text-[0.6rem] tracking-lockup -mr-[0.42em] text-accent-muted">
          {year}
        </span>
      ) : null}
    </span>
  );
}
