"use client";
/*
  The Drop (Chapter 3): Vault Lock & Secret Location Beacon Drop.
  Three concentric mechanical vault rings assemble above the horizontal coin
  like a combination lock clicking into alignment. When Chapter 3 arms, a
  faceted 3D Location Drop Pin prism strikes down along a vertical laser beacon
  into the coin's bullseye, triggering dual sonar shockwave rings and 34
  drifting golden-crimson vault embers before hovering as an active beacon.

  Units: 1 = the coin's radius; the rig's base is at y = 0, its axis is +Y.
  CoinRig places and scales the root group every frame.
*/
import { useFrame } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  ShaderMaterial,
  TorusGeometry,
} from "three";
import type { Palette } from "../colors";
import { motion } from "../store";

const SURFACE_Y = 0.24;
const DROP_START_Y = 3.6;
const GRAVITY = 16;
const DROPLETS = 34;

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uGold;
  uniform vec3 uCrimson;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float fresnel = pow(max(0.0, abs(dot(n, vView))), 1.5);
    float verticalFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
    vec3 col = mix(uCrimson, uGold, smoothstep(0.0, 0.65, 1.0 - vUv.y));
    float alpha = fresnel * verticalFade * uOpacity;
    gl_FragColor = vec4(col * (1.2 + fresnel * 0.8), alpha);
    #include <colorspace_fragment>
  }
`;

export type FluteRig = { root: Group; setLevel: (level: number) => void };

type Props = { palette: Palette; splash: boolean; onImpact: () => void };

export const Flute = forwardRef<FluteRig, Props>(function Flute({ palette, splash, onImpact }, ref) {
  const root = useRef<Group>(null!);
  const ringOuter = useRef<Group>(null!);
  const ringMid = useRef<Group>(null!);
  const ringInner = useRef<Group>(null!);
  const pinGroup = useRef<Group>(null!);
  const pinCage = useRef<Mesh>(null!);
  const beam = useRef<Mesh>(null!);
  const wave1 = useRef<Mesh>(null!);
  const wave2 = useRef<Mesh>(null!);
  const droplets = useRef<InstancedMesh>(null!);
  const level = useRef(0);

  const geo = useMemo(() => {
    // Tip of the inverted obelisk is at local y = 0, extending up to y = 0.46
    const pinTip = new ConeGeometry(0.145, 0.46, 4);
    pinTip.rotateX(Math.PI);
    pinTip.translate(0, 0.23, 0);

    // Crown sits seamlessly atop the inverted cone base at y = 0.46..0.64
    const pinCrown = new ConeGeometry(0.145, 0.18, 4);
    pinCrown.translate(0, 0.55, 0);

    // Laser beam cylinder with base at y = 0 and top at y = 1
    const laser = new CylinderGeometry(0.014, 0.095, 1, 24, 1, true);
    laser.translate(0, 0.5, 0);

    // Horizontal torus geometries (rotated into XZ plane)
    const outerGold = new TorusGeometry(0.76, 0.022, 8, 48);
    outerGold.rotateX(Math.PI / 2);

    const outerOnyx = new TorusGeometry(0.71, 0.016, 6, 8);
    outerOnyx.rotateX(Math.PI / 2);

    const midOctagram = new TorusGeometry(0.51, 0.02, 6, 8);
    midOctagram.rotateX(Math.PI / 2);

    const innerReticle = new TorusGeometry(0.27, 0.016, 8, 32);
    innerReticle.rotateX(Math.PI / 2);

    const cage = new TorusGeometry(0.21, 0.008, 4, 8);

    const shockwave = new TorusGeometry(1, 0.012, 8, 48);
    shockwave.rotateX(Math.PI / 2);

    const spark = new OctahedronGeometry(1, 0);

    return {
      pinTip,
      pinCrown,
      laser,
      outerGold,
      outerOnyx,
      midOctagram,
      innerReticle,
      cage,
      shockwave,
      spark,
    };
  }, []);

  const mat = useMemo(
    () => ({
      goldRing: new MeshStandardMaterial({
        color: palette["--ic-gold-100"],
        emissive: palette["--ic-gold-300"],
        emissiveIntensity: 0.22,
        metalness: 0.92,
        roughness: 0.2,
        transparent: true,
        opacity: 0,
      }),
      onyxRing: new MeshStandardMaterial({
        color: palette["--ic-onyx"],
        emissive: palette["--ic-gold-300"],
        emissiveIntensity: 0.08,
        metalness: 0.75,
        roughness: 0.32,
        transparent: true,
        opacity: 0,
      }),
      innerRing: new MeshStandardMaterial({
        color: palette["--ic-gold-bright"],
        emissive: palette["--ic-drop"],
        emissiveIntensity: 0.35,
        metalness: 0.88,
        roughness: 0.18,
        transparent: true,
        opacity: 0,
      }),
      pinBody: new MeshPhysicalMaterial({
        color: palette["--ic-drop"],
        emissive: palette["--ic-drop-deep"],
        emissiveIntensity: 0.55,
        metalness: 0.35,
        roughness: 0.12,
        clearcoat: 1,
        flatShading: true,
        transparent: true,
        opacity: 0,
      }),
      pinCrown: new MeshStandardMaterial({
        color: palette["--ic-gold-bright"],
        emissive: palette["--ic-gold-100"],
        emissiveIntensity: 0.45,
        metalness: 0.95,
        roughness: 0.12,
        flatShading: true,
        transparent: true,
        opacity: 0,
      }),
      beam: new ShaderMaterial({
        uniforms: {
          uGold: { value: palette["--ic-gold-100"] },
          uCrimson: { value: palette["--ic-drop"] },
          uOpacity: { value: 0 },
        },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
      wave1: new MeshStandardMaterial({
        color: palette["--ic-gold-bright"],
        emissive: palette["--ic-drop"],
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      wave2: new MeshStandardMaterial({
        color: palette["--ic-gold-100"],
        emissive: palette["--ic-gold-bright"],
        emissiveIntensity: 0.75,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      spark: new MeshStandardMaterial({
        color: palette["--ic-gold-bright"],
        emissive: palette["--ic-drop"],
        emissiveIntensity: 0.85,
        roughness: 0.15,
        metalness: 0.8,
      }),
    }),
    [palette],
  );

  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(mat)) m.dispose();
    },
    [geo, mat],
  );

  // Ember particle state: x, y, z, vx, vy, vz, size per particle, in one typed array.
  const sim = useMemo(() => new Float32Array(DROPLETS * 7), []);
  const dummy = useMemo(() => new Object3D(), []);
  const tint = useMemo(() => new Color(), []);
  const seq = useRef({ phase: "idle" as "idle" | "falling" | "splash" | "done", t: 0, clock: 0 });

  useImperativeHandle(ref, () => ({
    root: root.current,
    setLevel: (l: number) => {
      level.current = l;
    },
  }));

  useEffect(() => {
    // Hide every spark until the beacon impact.
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < DROPLETS; i++) {
      droplets.current.setMatrixAt(i, dummy.matrix);
      const isCrimson = i % 3 === 0;
      tint.copy(isCrimson ? palette["--ic-drop"] : palette["--ic-gold-bright"]);
      droplets.current.setColorAt(i, tint);
    }
    droplets.current.instanceMatrix.needsUpdate = true;
    if (droplets.current.instanceColor) droplets.current.instanceColor.needsUpdate = true;
  }, [dummy, tint, palette]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 20);
    const l = level.current;
    root.current.visible = l > 0.01;
    if (!root.current.visible) return;

    const s = seq.current;
    s.clock += delta;

    // Smooth ease-out curve for Stage 1 vault ring assembly (0 -> 1)
    const lock = 1 - Math.pow(1 - Math.min(1, Math.max(0, l)), 3);
    const unlockedAngle = (1 - lock) * Math.PI * 1.35;

    // Stage 1: Concentric mechanical vault rings rise in staggered layers and counter-rotate into lock
    ringOuter.current.position.y = 0.08 * lock;
    ringOuter.current.rotation.y = unlockedAngle + s.clock * 0.18;
    ringOuter.current.scale.setScalar(0.72 + 0.28 * lock);

    ringMid.current.position.y = 0.18 * lock;
    ringMid.current.rotation.y = -unlockedAngle * 1.4 - s.clock * 0.28;
    ringMid.current.scale.setScalar(0.6 + 0.4 * lock);

    ringInner.current.position.y = 0.28 * lock;
    ringInner.current.rotation.y = unlockedAngle * 1.8 + s.clock * 0.42;
    ringInner.current.scale.setScalar(0.5 + 0.5 * lock);

    mat.goldRing.opacity = 0.92 * lock;
    mat.onyxRing.opacity = 0.95 * lock;
    mat.innerRing.opacity = 0.95 * lock;
    mat.pinBody.opacity = Math.min(1, l * 1.25);
    mat.pinCrown.opacity = Math.min(1, l * 1.25);

    // Rotate the octagram cage around the prism
    pinCage.current.rotation.y = -s.clock * 1.1;
    pinCage.current.rotation.z = Math.PI / 4 + Math.sin(s.clock * 1.6) * 0.15;

    if (s.phase === "idle") {
      // Pre-strike: prism levitates above the assembling rings, awaiting the 72h beacon trigger
      pinGroup.current.visible = true;
      pinGroup.current.position.set(0, 0.58 * lock + Math.sin(s.clock * 2.4) * 0.035, 0);
      pinGroup.current.rotation.y = s.clock * 0.75;
      pinGroup.current.scale.setScalar(0.75 + 0.25 * lock);

      beam.current.visible = true;
      beam.current.scale.set(0.65, 0.9 + 0.4 * lock, 0.65);
      mat.beam.uniforms.uOpacity.value = 0.22 * lock;

      wave1.current.visible = false;
      wave2.current.visible = false;

      if (splash && motion.dropArmedAt > 0 && l > 0.88) {
        s.phase = "falling";
        s.t = 0;
      }
      return;
    }

    s.t += delta;

    // Stage 2: The 72-Hour Beacon Strike
    if (s.phase === "falling") {
      const y = DROP_START_Y - 0.5 * GRAVITY * s.t * s.t;
      const clampedY = Math.max(y, SURFACE_Y);

      pinGroup.current.visible = true;
      pinGroup.current.position.set(0, clampedY, 0);
      pinGroup.current.rotation.y += delta * 6.5;
      pinGroup.current.scale.set(0.95, 1.22, 0.95);
      mat.pinBody.emissiveIntensity = 1.1;

      beam.current.visible = true;
      beam.current.scale.set(1.15, DROP_START_Y + 0.6, 1.15);
      mat.beam.uniforms.uOpacity.value = 0.85 * l;

      if (y <= SURFACE_Y) {
        s.phase = "splash";
        s.t = 0;
        for (let i = 0; i < DROPLETS; i++) {
          const a = (i / DROPLETS) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.28;
          const out = 0.48 + ((i * 7) % 5) * 0.19;
          const o = i * 7;
          sim[o] = Math.cos(a) * 0.1;
          sim[o + 1] = SURFACE_Y * 0.5;
          sim[o + 2] = Math.sin(a) * 0.1;
          sim[o + 3] = Math.cos(a) * out;
          sim[o + 4] = 0.85 + ((i * 13) % 7) * 0.22;
          sim[o + 5] = Math.sin(a) * out;
          sim[o + 6] = 0.014 + ((i * 3) % 4) * 0.006;
        }
        onImpact();
      }
      return;
    }

    // Stage 3: Impact Shockwave & Floating Vault Embers + Locked Beacon Hover
    const hoverPulse = Math.sin(s.clock * 2.8);
    pinGroup.current.visible = true;
    pinGroup.current.position.set(0, SURFACE_Y + 0.08 + hoverPulse * 0.03, 0);
    pinGroup.current.rotation.y += delta * 0.95;
    pinGroup.current.scale.setScalar(1);
    mat.pinBody.emissiveIntensity = 0.65 + (hoverPulse * 0.5 + 0.5) * 0.35;
    mat.innerRing.emissiveIntensity = 0.55 + (hoverPulse * 0.5 + 0.5) * 0.35;

    // Sustained coordinates laser column after lock
    beam.current.visible = true;
    const beamCooldown = s.phase === "splash" ? Math.max(0, 1 - s.t * 0.65) : 0;
    beam.current.scale.set(0.75 + beamCooldown * 0.35, 1.8 + beamCooldown * 1.4, 0.75 + beamCooldown * 0.35);
    mat.beam.uniforms.uOpacity.value = (0.34 + beamCooldown * 0.5) * l;

    if (s.phase === "splash") {
      // Expanding dual horizontal sonar shockwave rings across the coin face
      const w1 = Math.min(1, s.t / 1.15);
      wave1.current.visible = w1 < 1;
      const w1Ease = 1 - Math.pow(1 - w1, 3);
      wave1.current.scale.setScalar(0.18 + w1Ease * 1.18);
      mat.wave1.opacity = (1 - w1) * 0.85 * l;

      const w2 = Math.min(1, Math.max(0, (s.t - 0.18) / 1.25));
      wave2.current.visible = s.t > 0.18 && w2 < 1;
      const w2Ease = 1 - Math.pow(1 - w2, 3);
      wave2.current.scale.setScalar(0.18 + w2Ease * 1.32);
      mat.wave2.opacity = (1 - w2) * 0.65 * l;

      // 34 golden-crimson vault embers burst outward and drift upward before fading
      const drag = Math.pow(0.42, delta);
      let alive = 0;
      for (let i = 0; i < DROPLETS; i++) {
        const o = i * 7;
        sim[o + 3] *= drag;
        sim[o + 5] *= drag;
        // Embers decelerate vertically and drift upward with warm vault buoyancy
        sim[o + 4] = sim[o + 4] * drag + 0.28 * delta;
        sim[o] += sim[o + 3] * delta;
        sim[o + 1] += sim[o + 4] * delta;
        sim[o + 2] += sim[o + 5] * delta;

        const life = Math.max(0, 1 - s.t / (1.35 + (i % 5) * 0.16));
        dummy.position.set(sim[o], sim[o + 1], sim[o + 2]);
        dummy.rotation.set(s.t * 2.2 + i, s.t * 3.1 + i, 0);
        dummy.scale.setScalar(sim[o + 6] * life);
        dummy.updateMatrix();
        droplets.current.setMatrixAt(i, dummy.matrix);
        if (life > 0.01) alive++;
      }
      droplets.current.instanceMatrix.needsUpdate = true;

      if (alive === 0 && s.t > 1.5) {
        wave1.current.visible = false;
        wave2.current.visible = false;
        s.phase = "done";
      }
    }
  });

  return (
    <group ref={root} visible={false}>
      {/* Stage 1: Three Concentric Mechanical Vault Rings */}
      <group ref={ringOuter}>
        <mesh geometry={geo.outerGold} material={mat.goldRing} renderOrder={1} />
        <mesh geometry={geo.outerOnyx} material={mat.onyxRing} position={[0, -0.018, 0]} renderOrder={1} />
      </group>
      <group ref={ringMid}>
        <mesh geometry={geo.midOctagram} material={mat.goldRing} renderOrder={1} />
      </group>
      <group ref={ringInner}>
        <mesh geometry={geo.innerReticle} material={mat.innerRing} renderOrder={1} />
      </group>

      {/* Stage 2: Levitating 3D Faceted Location Drop Pin & Laser Beacon */}
      <group ref={pinGroup}>
        <mesh geometry={geo.pinTip} material={mat.pinBody} renderOrder={2} />
        <mesh geometry={geo.pinCrown} material={mat.pinCrown} renderOrder={2} />
        <mesh ref={pinCage} geometry={geo.cage} material={mat.goldRing} position={[0, 0.36, 0]} renderOrder={2} />
      </group>
      <mesh ref={beam} geometry={geo.laser} material={mat.beam} renderOrder={3} visible={false} />

      {/* Stage 3: Dual Horizontal Sonar Shockwaves & 34 Vault Ember Sparks */}
      <mesh ref={wave1} geometry={geo.shockwave} material={mat.wave1} position={[0, 0.04, 0]} renderOrder={3} visible={false} />
      <mesh ref={wave2} geometry={geo.shockwave} material={mat.wave2} position={[0, 0.05, 0]} renderOrder={3} visible={false} />
      <instancedMesh ref={droplets} args={[geo.spark, mat.spark, DROPLETS]} frustumCulled={false} renderOrder={3} />
    </group>
  );
});
