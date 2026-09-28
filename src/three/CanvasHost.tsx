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

    // Arm the 3D stage promptly after first paint so the scene hydrates without artificial delay.
    const armTimer = window.setTimeout(() => setArmed(true), 80);
    return () => {
      mq.removeEventListener("change", onChange);
      window.clearTimeout(armTimer);
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
