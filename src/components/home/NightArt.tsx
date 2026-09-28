import Image from "next/image";
import launchPost from "../../../public/brand/launch-post.png";
import logo from "../../../public/brand/logo.jpg";

/**
 * Card art for a past night. The launch night uses the team's own post; the
 * others are original placeholder cards built around the logo, each in its
 * night's world, and marked as demo artwork.
 */
export function NightArt({ posterKey, theme, title }: { posterKey: string | null; theme: string; title: string }) {
  if (posterKey === "launch-post") {
    return (
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={launchPost}
          alt="The Grand Launch post: the gold coin on an octagram mount over black marble and flames, under the words Grand Launch and Underdogs Innercircle."
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
          className="h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  const aegean = theme === "aegean";
  return (
    <div data-theme={aegean ? "aegean" : "vault"} className={`night-art ${aegean ? "night-art-aegean" : "night-art-vault"} relative flex aspect-[4/5] flex-col items-center justify-center gap-4 overflow-hidden`}>
      <Image src={logo} alt="" sizes="9rem" className="coin-photo relative z-10 w-36" />
      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        {aegean ? (
          <>
            <span className="font-night text-3xl leading-none text-heading">LA DOLCE VITA</span>
            <span className="font-display text-xs tracking-[0.3em] text-accent">80s EDITION</span>
          </>
        ) : (
          <>
            <span className="gold-leaf font-display text-3xl leading-none tracking-[0.12em]">WONDERLAND</span>
            <span className="font-display text-xs tracking-[0.3em] text-accent">NYE</span>
          </>
        )}
      </div>
      {aegean ? (
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-1/5 w-full" aria-hidden>
          <path d="M0 40V22h18v-6h16v10h14V14h20v12h12v-8h22v8h16V16h18v10h14v-6h16v8h18v14Z" className="fill-text" />
          <path d="M58 14a10 10 0 0 1 20 0ZM130 16a9 9 0 0 1 18 0Z" className="fill-accent" />
        </svg>
      ) : null}
      <span className="demo-tag absolute top-3 right-3 z-10">Demo artwork</span>
      <span className="sr-only">Placeholder art for {title}</span>
    </div>
  );
}
