import Image from "next/image";
import logo from "../../public/brand/logo.jpg";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Underdogs Innercircle"
      className="relative flex min-h-[75vh] w-full flex-col items-center justify-center px-4 py-16 text-center select-none"
    >
      {/* Ambient gold radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-accent/10 blur-[90px] animate-pulse"
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Underdogs Logo Coin Emblem */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl animate-ping" style={{ animationDuration: "3s" }} />
          <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full border border-rule/60 bg-surface/80 shadow-[0_0_30px_rgba(203,176,116,0.2)] backdrop-blur-md">
            <Image
              src={logo}
              alt="Underdogs Innercircle"
              fill
              sizes="7rem"
              priority
              className="coin-photo object-cover"
            />
            <span className="coin-glint" aria-hidden />
          </div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="eyebrow tracking-[0.28em] text-[0.7rem] text-accent-muted">Nagpur · Members Only</span>
          <h2 className="diamond-caps font-display text-2xl font-bold tracking-[0.14em] sm:text-3xl text-heading">
            UNDERDOGS INNERCIRCLE
          </h2>
        </div>

        {/* Sleek luxury progress hairline */}
        <div className="relative mt-2 h-[2px] w-36 overflow-hidden rounded-full bg-surface-raised border border-rule/30">
          <div className="loading-shimmer-bar absolute inset-y-0 w-20 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
        </div>
      </div>
    </div>
  );
}
