"use client";
/*
  The one <Canvas>. Mounted once, from the root layout, client-only and after
  first paint (CanvasHost). Every 3D scene renders into a drei View that
  tracks a DOM slot; never add a second canvas.
*/
import { PerformanceMonitor, View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState, type RefObject } from "react";
import { NeutralToneMapping } from "three";
import HomeView from "./HomeView";
import { motion, useStage } from "./store";

export default function Stage() {
  const tier = useStage((s) => s.tier);
  const theme = useStage((s) => s.theme);
  const slots = useStage((s) => s.slots);
  const degrade = useStage((s) => s.degrade);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastMoveTime = 0;
    let movedDist = 0;

    const isInteractiveDomTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("a, button, input, textarea, select, label, summary, [role='button']"));
    };

    const isInsideCoin = (clientX: number, clientY: number): boolean => {
      if (motion.coinScreenR <= 8) return false;
      const dx = clientX - motion.coinScreenX;
      const dy = clientY - motion.coinScreenY;
      return Math.hypot(dx, dy) <= motion.coinScreenR * 1.08;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || isInteractiveDomTarget(e.target)) return;
      if (!isInsideCoin(e.clientX, e.clientY)) return;
      dragging = true;
      motion.isDraggingCoin = true;
      motion.userVelY = 0;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveTime = performance.now();
      movedDist = 0;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    };

    const onPointerMove = (e: PointerEvent) => {
      motion.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointerY = (e.clientY / window.innerHeight) * 2 - 1;

      if (dragging) {
        const now = performance.now();
        const dt = Math.max(8, now - lastMoveTime) / 1000;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        movedDist += Math.hypot(dx, dy);
        lastX = e.clientX;
        lastY = e.clientY;
        lastMoveTime = now;

        motion.userRotY += dx * 0.014;
        motion.userRotX = Math.max(-0.65, Math.min(0.65, motion.userRotX + dy * 0.008));
        motion.userVelY = (dx * 0.014) / dt;
        return;
      }

      if (!isInteractiveDomTarget(e.target) && isInsideCoin(e.clientX, e.clientY)) {
        if (document.body.style.cursor !== "grab") {
          document.body.style.cursor = "grab";
        }
      } else if (document.body.style.cursor === "grab" || document.body.style.cursor === "grabbing") {
        document.body.style.cursor = "";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      motion.isDraggingCoin = false;
      document.body.style.userSelect = "";

      const total = Math.max(movedDist, Math.hypot(e.clientX - startX, e.clientY - startY));
      if (total < 8) {
        // Click on the coin: rotate 180° (flip between Heads and Tails) with a glint flash.
        motion.userRotY += Math.PI;
        motion.userRotX = 0;
        motion.userVelY = 0;
        motion.coinClickAt = performance.now() / 1000;
      }

      document.body.style.cursor = isInsideCoin(e.clientX, e.clientY) ? "grab" : "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    // Avoids the blank 300 × 150 canvas some browsers show on first layout.
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.clearTimeout(t);
    };
  }, []);

  const anySlot = Boolean(slots.home);
  const frameloop = hidden || !anySlot ? "never" : tier === "still" ? "demand" : "always";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        dpr={tier === "full" ? [1, 1.75] : [1, 1.5]}
        frameloop={frameloop}
        gl={{ antialias: tier === "full", alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.setClearColor(0x000000, 0);
        }}
        style={{ pointerEvents: "none" }}
      >
        {tier === "full" ? <PerformanceMonitor onDecline={degrade} flipflops={2} /> : null}
        {slots.home ? (
          <View track={slots.home as RefObject<HTMLElement>} index={1}>
            <HomeView tier={tier} theme={theme} />
          </View>
        ) : null}
      </Canvas>
    </div>
  );
}
