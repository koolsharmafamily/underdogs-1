"use client";
/*
  La Dolce Vita's world, from primitives: whitewashed lanes with Aegean domes
  along the bottom, and a marble statue head wearing a mirror-ball helmet.
  Chrome rings around the coin live in CoinRig (they follow the coin).
*/
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Group, IcosahedronGeometry, MeshStandardMaterial } from "three";
import type { Palette } from "../colors";

type Props = { palette: Palette; narrow: boolean; animate: boolean };

export function AegeanWorld({ palette, narrow, animate }: Props) {
  const statue = useRef<Group>(null);
  const helmet = useRef<Group>(null);

  const mats = useMemo(
    () => ({
      wall: new MeshStandardMaterial({ color: palette["--ic-whitewash"], roughness: 0.9 }),
      dome: new MeshStandardMaterial({ color: palette["--ic-aegean"], roughness: 0.55 }),
      marble: new MeshStandardMaterial({ color: palette["--ic-whitewash"], roughness: 0.5 }),
      mirror: new MeshStandardMaterial({ color: palette["--ic-chrome"], metalness: 1, roughness: 0.04, flatShading: true }),
      window: new MeshStandardMaterial({ color: palette["--ic-night"], roughness: 1 }),
    }),
    [palette],
  );
  const mirrorBall = useMemo(() => new IcosahedronGeometry(1, 3), []);
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) m.dispose();
      mirrorBall.dispose();
    },
    [mats, mirrorBall],
  );

  // Lanes: houses stepping down a hillside, some with blue domes.
  const houses = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; d: number; dome: boolean }[] = [];
    let x = -7.5;
    let k = 0;
    while (x < 7.5) {
      const w = 0.7 + ((k * 37) % 5) * 0.16;
      const h = 0.5 + ((k * 53) % 7) * 0.11;
      out.push({ x: x + w / 2, y: -2.6 + Math.abs(Math.sin(k * 1.7)) * 0.35, w, h, d: 0.8, dome: k % 3 === 1 });
      x += w + 0.08;
      k++;
    }
    return out;
  }, []);

  useFrame((state, delta) => {
    if (!animate || !helmet.current || !statue.current) return;
    helmet.current.rotation.y += delta * 0.25; // the mirror ball turns slowly
    statue.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.12 - 0.35;
  });

  return (
    <group>
      <group position={[0, narrow ? -0.2 : 0, -3.2]}>
        {houses.map((h, i) => (
          <group key={i} position={[h.x, h.y, 0]}>
            <mesh material={mats.wall} position={[0, h.h / 2, 0]}>
              <boxGeometry args={[h.w, h.h, h.d]} />
            </mesh>
            <mesh material={mats.window} position={[0, h.h * 0.45, h.d / 2 + 0.001]}>
              <planeGeometry args={[h.w * 0.18, h.h * 0.32]} />
            </mesh>
            {h.dome ? (
              <mesh material={mats.dome} position={[0, h.h, 0]}>
                <sphereGeometry args={[h.w * 0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
            ) : null}
          </group>
        ))}
      </group>

      {/* The statue: a marble head in a mirror-ball helmet, peeking in from one side. */}
      <group ref={statue} position={narrow ? [-1.15, 1.25, -2.4] : [-3.9, -0.4, -2.8]} scale={narrow ? 0.42 : 0.72} rotation={[0, -0.35, 0]}>
        <mesh material={mats.marble} scale={[0.82, 1.02, 0.9]}>
          <sphereGeometry args={[0.8, 40, 28]} />
        </mesh>
        <mesh material={mats.marble} position={[0, -0.05, 0.72]} rotation={[0.25, 0, 0]}>
          <coneGeometry args={[0.12, 0.34, 12]} />
        </mesh>
        <mesh material={mats.marble} position={[0, -0.95, -0.05]}>
          <cylinderGeometry args={[0.33, 0.42, 0.7, 24]} />
        </mesh>
        <mesh material={mats.marble} position={[0, -1.45, -0.05]} scale={[1.6, 0.5, 0.8]}>
          <sphereGeometry args={[0.7, 32, 16]} />
        </mesh>
        <group ref={helmet} position={[0, 0.3, -0.04]}>
          <mesh geometry={mirrorBall} material={mats.mirror} scale={[0.78, 0.66, 0.84]} />
        </group>
      </group>
    </group>
  );
}
