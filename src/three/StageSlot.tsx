"use client";
import { useEffect, useRef } from "react";
import { useStage, type SlotName } from "./store";

/**
 * A place on the page where 3D appears. It is an empty div; the canvas (in the
 * root layout) renders a drei View over it. Pages never import three.js.
 */
export function StageSlot({ name, className }: { name: SlotName; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const { registerSlot, unregisterSlot } = useStage.getState();
    registerSlot(name, ref);
    return () => unregisterSlot(name, ref);
  }, [name]);
  return <div ref={ref} aria-hidden className={className} />;
}
