"use client";
/*
  The drop: a champagne flute standing on the coin, a red drop falling into
  it, and a splash that hangs in the air for a beat before it falls. Plays once
  per page load, when chapter 3 is entered and the flute is up.

  Units: 1 = the coin's radius; the flute's base is at y = 0, its axis is +Y.
  CoinRig places and scales the root group every frame.
*/
import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
} from "three";
import type { Palette } from "../colors";
import { motion } from "../store";

const SURFACE_Y = 2.02;
const DROP_START_Y = 4.6;
const GRAVITY = 14;
const SPLASH_GRAVITY = 7;
const DROPLETS = 34;

const glassVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const glassFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    float f = pow(1.0 - abs(dot(n, vView)), 2.2);
    vec3 key = normalize(vec3(-0.6, 0.7, 0.5));
    float spec = pow(max(dot(reflect(-vView, n), key), 0.0), 60.0);
    float a = (0.05 + f * 0.6 + spec * 0.8) * uOpacity;
    gl_FragColor = vec4(uTint * (0.5 + f) + spec, a);
    #include <colorspace_fragment>
  }
`;

export type FluteRig = { root: Group; setLevel: (level: number) => void };

type Props = { palette: Palette; splash: boolean; onImpact: () => void };

export const Flute = forwardRef<FluteRig, Props>(function Flute({ palette, splash, onImpact }, ref) {
  const root = useRef<Group>(null!);
  const drop = useRef<Mesh>(null!);
  const droplets = useRef<InstancedMesh>(null!);
  const level = useRef(0);

  const geo = useMemo(() => {
    const glassProfile = [
      [0, 0.0], [0.42, 0.0], [0.44, 0.025], [0.12, 0.05], [0.04, 0.12], [0.032, 1.02], [0.06, 1.1],
      [0.2, 1.3], [0.26, 1.6], [0.272, 1.95], [0.265, 2.3], [0.258, 2.52],
    ].map(([x, y]) => new Vector2(x, y));
    const liquidProfile = [
      [0, 1.12], [0.05, 1.13], [0.18, 1.31], [0.236, 1.6], [0.246, SURFACE_Y - 0.02], [0.24, SURFACE_Y], [0, SURFACE_Y],
    ].map(([x, y]) => new Vector2(x, y));
    return {
      glass: new LatheGeometry(glassProfile, 48),
      liquid: new LatheGeometry(liquidProfile, 40),
      drop: new SphereGeometry(0.075, 16, 12),
      droplet: new SphereGeometry(1, 8, 6),
    };
  }, []);

  const baseLiquid = useMemo(() => palette["--ic-champagne"].clone(), [palette]);
  const redLiquid = useMemo(() => palette["--ic-champagne"].clone().lerp(palette["--ic-drop"], 0.45), [palette]);

  const mat = useMemo(
    () => ({
      glass: new ShaderMaterial({
        uniforms: { uTint: { value: palette["--ic-diamond"] }, uOpacity: { value: 0 } },
        vertexShader: glassVertex,
        fragmentShader: glassFragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
      liquid: new MeshStandardMaterial({
        color: baseLiquid.clone(),
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0,
        emissive: palette["--ic-champagne"],
        emissiveIntensity: 0.25,
      }),
      drop: new MeshPhysicalMaterial({
        color: palette["--ic-drop"],
        roughness: 0.08,
        clearcoat: 1,
        emissive: palette["--ic-drop-deep"],
        emissiveIntensity: 0.4,
      }),
    }),
    [palette, baseLiquid],
  );

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(mat)) m.dispose();
    },
    [geo, mat],
  );

  // Splash state: x, y, z, vx, vy, vz, size per droplet, in one typed array.
  const sim = useMemo(() => new Float32Array(DROPLETS * 7), []);
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const seq = useRef({ phase: "idle" as "idle" | "falling" | "splash" | "done", t: 0 });

  useImperativeHandle(ref, () => ({
    root: root.current,
    setLevel: (l: number) => {
      level.current = l;
    },
  }));

  useEffect(() => {
    // Hide every droplet until the splash.
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < DROPLETS; i++) droplets.current.setMatrixAt(i, dummy.matrix);
    droplets.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const l = level.current;
    root.current.visible = l > 0.01;
    mat.glass.uniforms.uOpacity.value = l;
    mat.liquid.opacity = 0.82 * l;

    const s = seq.current;
    if (s.phase === "idle") {
      drop.current.visible = false;
      if (splash && motion.dropArmedAt > 0 && l > 0.97) {
        s.phase = "falling";
        s.t = 0;
      }
      return;
    }
    s.t += delta;

    if (s.phase === "falling") {
      const y = DROP_START_Y - 0.5 * GRAVITY * s.t * s.t;
      drop.current.visible = true;
      drop.current.position.set(0, Math.max(y, SURFACE_Y), 0);
      drop.current.scale.set(1, 1.45, 1);
      if (y <= SURFACE_Y) {
        drop.current.visible = false;
        s.phase = "splash";
        s.t = 0;
        for (let i = 0; i < DROPLETS; i++) {
          const a = (i / DROPLETS) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.3;
          const out = 0.55 + ((i * 7) % 5) * 0.18;
          const o = i * 7;
          sim[o] = Math.cos(a) * 0.08;
          sim[o + 1] = SURFACE_Y;
          sim[o + 2] = Math.sin(a) * 0.08;
          sim[o + 3] = Math.cos(a) * out;
          sim[o + 4] = 1.6 + ((i * 13) % 7) * 0.26;
          sim[o + 5] = Math.sin(a) * out;
          sim[o + 6] = 0.009 + ((i * 3) % 4) * 0.005;
        }
        onImpact();
      }
      return;
    }

    if (s.phase === "splash") {
      // The splash hangs for a beat (slow time), then falls at full speed.
      const scale = s.t < 0.45 ? 0.18 : 1;
      const dt = delta * scale;
      let alive = 0;
      for (let i = 0; i < DROPLETS; i++) {
        const o = i * 7;
        sim[o + 4] -= SPLASH_GRAVITY * dt;
        sim[o] += sim[o + 3] * dt;
        sim[o + 1] += sim[o + 4] * dt;
        sim[o + 2] += sim[o + 5] * dt;
        const falling = sim[o + 1] < SURFACE_Y - 0.05 && sim[o + 4] < 0;
        dummy.position.set(sim[o], sim[o + 1], sim[o + 2]);
        dummy.scale.setScalar(falling ? 0 : sim[o + 6]);
        dummy.updateMatrix();
        droplets.current.setMatrixAt(i, dummy.matrix);
        if (!falling) alive++;
      }
      droplets.current.instanceMatrix.needsUpdate = true;
      // The champagne blushes with the drop.
      tint.copy(baseLiquid).lerp(redLiquid, Math.min(1, s.t * 1.5));
      mat.liquid.color.copy(tint);
      if (alive === 0 && s.t > 0.6) s.phase = "done";
    }
  });

  return (
    <group ref={root} visible={false}>
      <mesh geometry={geo.liquid} material={mat.liquid} renderOrder={1} />
      <mesh geometry={geo.glass} material={mat.glass} renderOrder={2} />
      <mesh ref={drop} geometry={geo.drop} material={mat.drop} visible={false} />
      <instancedMesh ref={droplets} args={[geo.droplet, mat.drop, DROPLETS]} frustumCulled={false} />
    </group>
  );
});
