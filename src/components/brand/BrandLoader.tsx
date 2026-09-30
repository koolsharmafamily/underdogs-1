"use client";
/*
  The instant branded splash loader for Underdogs Innercircle.
  Displays the official Underdogs logo on pure studio black immediately when
  the website link is opened, remaining visible while the 3D assets load. Once
  the 3D coin renders its initial frames, this loader dissolves smoothly,
  unveiling the homepage with the 3D coin already in active motion.
*/
import Image from "next/image";
import { useEffect, useState } from "react";
import logo from "../../../public/brand/logo.jpg";
import { useStage } from "@/three/store";

export function BrandLoader() {
  const ready = useStage((s) => s.ready);
  const tier = useStage((s) => s.tier);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    // When 3D stage draws its first frames, or if device has no WebGL, dismiss the loader smoothly.
    if (ready || tier === "none") {
      const dismissTimer = window.setTimeout(() => setMounted(false), 900);
      return () => window.clearTimeout(dismissTimer);
    }

    // Safety fallback: if network/device stalls, reveal the site after 4.5 seconds.
    const safetyTimer = window.setTimeout(() => setMounted(false), 4500);
    return () => window.clearTimeout(safetyTimer);
  }, [ready, tier]);

  if (!mounted) return null;

  return (
    <div
      id="brand-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading Underdogs Innercircle"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505] px-4 text-center select-none overflow-hidden transition-all duration-700 ease-out"
    >
      {/* Ambient warm gold atmospheric glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-accent/15 blur-[95px] animate-pulse"
      />

      <div className="relative z-10 flex flex-col items-center">
        {/* The Underdogs Logo Coin Emblem */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full bg-accent/25 blur-2xl animate-ping"
            style={{ animationDuration: "3.2s" }}
          />
          <div className="relative h-28 w-28 sm:h-36 sm:w-36 overflow-hidden rounded-full border border-accent/40 bg-black shadow-[0_0_50px_rgba(203,176,116,0.25)]">
            <Image
              src={logo}
              alt="Underdogs Innercircle"
              priority
              fill
              sizes="(min-width: 640px) 9rem, 7rem"
              className="coin-photo object-cover"
            />
            <span className="coin-glint" aria-hidden />
          </div>
        </div>

        {/* Wordmark */}
        <div className="mt-6 flex flex-col items-center gap-1.5">
          <span className="eyebrow tracking-[0.28em] text-[0.68rem] text-accent-muted sm:text-xs">
            Nagpur · Members Only
          </span>
          <h2 className="diamond-caps font-display text-xl sm:text-2xl font-bold tracking-[0.14em] text-heading">
            UNDERDOGS INNERCIRCLE
          </h2>
        </div>

        {/* Sleek luxury progress hairline */}
        <div className="relative mt-5 h-[2px] w-36 sm:w-44 overflow-hidden rounded-full bg-surface-raised border border-rule/30">
          <div className="loading-shimmer-bar absolute inset-y-0 w-24 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
        </div>
      </div>
    </div>
  );
}
