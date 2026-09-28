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
    const onPointer = (e: PointerEvent) => {
      motion.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointer, { passive: true });
    // Avoids the blank 300 × 150 canvas some browsers show on first layout.
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
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
