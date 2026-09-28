"use client";
/*
  The home page's 3D: rendered into the "home" View slot (the whole viewport,
  behind the six chapters). The world changes with the theme; the coin never does.
*/
import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import type { Texture } from "three";
import { readPalette } from "./colors";
import { CoinRig } from "./CoinRig";
import { loadHeadsTextures, makeEdgeBump, makeGlintTexture, makeHaloTexture, makeTailsTextures } from "./coin/textures";
import { isNarrow, type Tier } from "./store";
import { AegeanWorld } from "./world/Aegean";
import { AegeanSky, Firelight, Satin } from "./world/Backdrops";
import { GoldConfetti, Stars } from "./world/Particles";

type FaceTex = { map: Texture; bump: Texture };

export default function HomeView({ tier, theme }: { tier: Tier; theme: string }) {
  const { size, viewport } = useThree();
  const narrow = isNarrow(size.width, size.height);
  // Read after the theme attribute has changed, so Aegean tokens resolve.
  const palette = useMemo(() => {
    void theme;
    return readPalette();
  }, [theme]);

  const [heads, setHeads] = useState<FaceTex | null>(null);
  const [tails, setTails] = useState<FaceTex | null>(null);
  const small = useMemo(() => ({ edge: makeEdgeBump(), glint: makeGlintTexture(), halo: makeHaloTexture() }), []);

  useEffect(() => {
    let alive = true;
    let h: FaceTex | null = null;
    let t: FaceTex | null = null;
    loadHeadsTextures(tier === "full" ? 1024 : 512)
      .then((tex) => {
        h = tex;
        if (alive) setHeads(tex);
      })
      .catch(() => undefined);
    makeTailsTextures({}, tier === "full" ? 1024 : 512)
      .then((tex) => {
        t = tex;
        if (alive) setTails(tex);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      for (const x of [h, t]) {
        x?.map.dispose();
        x?.bump.dispose();
      }
    };
  }, [tier]);
  useEffect(() => () => Object.values(small).forEach((t) => t.dispose()), [small]);

  const animate = tier === "full" || tier === "lite";
  const aegean = theme === "aegean";
  const confetti = tier === "full" ? 70 : tier === "lite" ? 24 : 16;
  const stars = tier === "full" ? 520 : 220;

  return (
    <>
      <PerspectiveCamera makeDefault fov={34} position={[0, 0, 6.2]} near={0.1} far={40}>
        {tier === "full" && !aegean ? <Firelight palette={palette} /> : null}
      </PerspectiveCamera>

      {/* Studio light from lightformers only: nothing is fetched. Warm key from the top left, as in Logo.jpg. */}
      <Environment key={theme} frames={1} resolution={tier === "full" ? 256 : 128}>
        {aegean ? (
          <>
            <Lightformer form="rect" intensity={3} color={palette["--ic-sky"]} position={[-4, 4, 3]} scale={[6, 3, 1]} />
            <Lightformer form="rect" intensity={1.6} color={palette["--ic-whitewash"]} position={[4, 1, 3]} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={3} color={palette["--ic-aegean"]} position={[0, -3, -4]} scale={[9, 1.2, 1]} />
            <Lightformer form="rect" intensity={2} color={palette["--ic-chrome"]} position={[0, 5, -2]} scale={[10, 0.6, 1]} />
            <Lightformer form="rect" intensity={2.2} color={palette["--ic-gold-100"]} position={[-2, 2, 5]} scale={[2, 2, 1]} />
            <Lightformer form="rect" intensity={0.6} color={palette["--ic-whitewash"]} position={[0, 0, 9]} scale={[14, 9, 1]} />
          </>
        ) : (
          <>
            <Lightformer form="rect" intensity={4} color={palette["--ic-gold-100"]} position={[-4, 4, 3]} scale={[6, 3, 1]} />
            <Lightformer form="rect" intensity={0.9} color={palette["--ic-ivory"]} position={[4, 0, 2]} scale={[3, 6, 1]} />
            <Lightformer form="rect" intensity={2.4} color={palette["--ic-ember"]} position={[0, -3, -4]} scale={[9, 1.2, 1]} />
            <Lightformer form="rect" intensity={1.4} color={palette["--ic-ivory"]} position={[0, 5, -2]} scale={[10, 0.6, 1]} />
            <Lightformer form="ring" intensity={1.2} color={palette["--ic-champagne"]} position={[2, 3, 5]} scale={[2, 2, 1]} />
            {/* A big soft box behind the camera: what a face-on coin mirrors. */}
            <Lightformer form="rect" intensity={0.7} color={palette["--ic-champagne"]} position={[0, 0, 9]} scale={[14, 9, 1]} />
          </>
        )}
      </Environment>

      {aegean ? (
        <>
          <AegeanSky palette={palette} />
          <Stars palette={palette} count={stars} animate={animate} pixelRatio={viewport.dpr} />
          <AegeanWorld palette={palette} narrow={narrow} animate={animate} />
        </>
      ) : (
        <>
          <Satin palette={palette} animate={tier === "full"} />
          <GoldConfetti palette={palette} count={confetti} animate={animate} />
        </>
      )}

      <CoinRig tier={tier} theme={theme} palette={palette} textures={{ heads, tails, ...small }} />
    </>
  );
}
