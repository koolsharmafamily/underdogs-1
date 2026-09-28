"use client";
/*
  Decides the tier and, only when a page has a 3D slot and the tier allows it,
  loads the 3D chunk after first paint. Rendered once, in the root layout.
*/
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useStage } from "./store";
import { chooseTier, readSignals, readTierOverride } from "./tier";

const Stage = dynamic(() => import("./Stage"), { ssr: false });

export function CanvasHost() {
  const tier = useStage((s) => s.tier);
  const ready = useStage((s) => s.ready);
  const hasSlot = useStage((s) => Object.keys(s.slots).length > 0);
  const [armed, setArmed] = useState(false);

  // Detect once, then listen for a change in the reduced-motion setting.
  useEffect(() => {
    const { setDetected, setOverride } = useStage.getState();
    setDetected(chooseTier(readSignals()));
    setOverride(readTierOverride());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setDetected(chooseTier(readSignals()));
    mq.addEventListener("change", onChange);

    // Wait for first paint and a quiet moment before fetching the 3D chunk.
    let idle = 0;
    const arm = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => setArmed(true), { timeout: 1500 }) as number;
    };
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("load", arm);
      window.cancelIdleCallback?.(idle);
    };
  }, []);

  // The theme lives on <html data-theme>; the canvas follows it.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => useStage.getState().setTheme(root.dataset.theme ?? "vault");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tier = tier;
  }, [tier]);
  useEffect(() => {
    if (ready) document.documentElement.dataset.stage = "ready";
    else delete document.documentElement.dataset.stage;
  }, [ready]);

  if (!armed || !hasSlot || tier === "none") return null;
  return <Stage />;
}
