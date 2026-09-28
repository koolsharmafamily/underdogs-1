"use client";
import dynamic from "next/dynamic";

/** GSAP and ScrollTrigger load after first paint, and only on the home page. */
const ScrollDriver = dynamic(() => import("./ScrollDriver"), { ssr: false });

export function HomeScroll() {
  return <ScrollDriver />;
}
