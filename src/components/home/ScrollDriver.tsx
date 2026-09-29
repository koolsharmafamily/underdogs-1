"use client";
/*
  Scroll → motion store. ScrollTrigger measures each chapter and writes
  progress into `motion` (read inside useFrame); it never tweens three.js
  objects and never sets React state per frame. It also flips a few DOM
  attributes (the lit step, the face card, stamps) directly.
  Loaded lazily, only on the home page.
*/
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, resetMotion, useStage } from "@/three/store";

gsap.registerPlugin(ScrollTrigger, useGSAP);
ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });

const now = () => performance.now() / 1000;

export default function ScrollDriver() {
  const tier = useStage((s) => s.tier);

  useGSAP(
    () => {
      resetMotion();
      const chapters = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
      for (const el of chapters) {
        const i = Number(el.dataset.chapter);
        const tall = el.classList.contains("chapter-tall") && (tier === "full" || tier === "lite");
        const stepEls = i === 3 ? Array.from(el.querySelectorAll<HTMLElement>("[data-step]")) : [];
        let lastFace = el.dataset.face ?? "heads";
        let lastLit = -1;

        ScrollTrigger.create({
          trigger: el,
          start: i === 0 ? "top top" : tall ? "top 50%" : "top 75%",
          end: tall ? "bottom bottom" : i === 5 ? "top 25%" : "bottom 60%",
          onUpdate: (self) => {
            motion.progress[i] = self.progress;
            if (i === 1) {
              const nextFace = self.progress >= 0.5 ? "tails" : "heads";
              if (nextFace !== lastFace) {
                lastFace = nextFace;
                el.dataset.face = nextFace;
              }
            }
            if (i === 3) {
              const lit = Math.min(6, Math.floor(self.progress * 6.2));
              if (lit !== lastLit) {
                lastLit = lit;
                for (let sIdx = 0; sIdx < stepEls.length; sIdx++) {
                  const stepEl = stepEls[sIdx];
                  if (stepEl) stepEl.toggleAttribute("data-lit", Number(stepEl.dataset.step) < lit);
                }
              }
            }
          },
          onEnter: () => {
            motion.entered[i] = true;
            // The drop plays once per visit, as the chapter comes in.
            if (i === 2 && !motion.dropArmedAt) motion.dropArmedAt = now();
          },
          onLeaveBack: () => {
            if (i > 0) motion.entered[i] = false;
          },
        });
      }

      for (const el of document.querySelectorAll<HTMLElement>("[data-stamp]")) {
        ScrollTrigger.create({
          trigger: el,
          start: "top 82%",
          once: true,
          onEnter: () => {
            el.toggleAttribute("data-stamped", true);
            motion.stampAt = now();
          },
        });
      }
      ScrollTrigger.refresh();

      // Still tier cross-fades chapters as they come into view (also true on load for the first).
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && e.target.toggleAttribute("data-inview", true)),
        { threshold: 0.15 },
      );
      chapters.forEach((el) => io.observe(el));
      return () => io.disconnect();
    },
    { dependencies: [tier], revertOnUpdate: true },
  );

  return null;
}
