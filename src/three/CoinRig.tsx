"use client";
/*
  Drives the coin (and the flute, halo, glints and chrome rings that follow it)
  from the keyframe table and the scroll progress in `motion`. Everything that
  changes per frame is written straight to three.js objects: no React state,
  no allocation inside useFrame.
*/
import { useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  Color,
  Group,
  MeshStandardMaterial,
  PerspectiveCamera,
  Sprite,
  SpriteMaterial,
  type Texture,
} from "three";
import type { Palette } from "./colors";
import { Coin, NOTCH_COUNT, type CoinParts } from "./coin/Coin";
import { Flute, type FluteRig } from "./world/Flute";
import { STILL_POSE, activeChapter, copyPose, emptyPose, samplePose } from "./keyframes";
import { isNarrow, motion, useStage, type Tier } from "./store";

const TAU = Math.PI * 2;
const GLINT_ANGLES = [2.3, 0.55, -2.5];

type Props = {
  tier: Tier;
  theme: string;
  palette: Palette;
  textures: {
    heads: { map: Texture; bump: Texture } | null;
    tails: { map: Texture; bump: Texture } | null;
    edge: Texture;
    glint: Texture;
    halo: Texture;
  };
};

export function CoinRig({ tier, theme, palette, textures }: Props) {
  const coin = useRef<CoinParts>(null);
  const flute = useRef<FluteRig>(null);
  const follower = useRef<Group>(null!); // follows the coin's position and scale, not its rotation
  const halo = useRef<Sprite>(null!);
  const glints = useRef<Sprite[]>([]);
  const chrome = useRef<Group>(null!);
  const { invalidate } = useThree();

  const full = tier === "full";
  const still = tier === "still";

  const target = useMemo(() => emptyPose(), []);
  const live = useRef({
    spin: 0,
    flute: 0,
    notches: 0,
    awake: 0,
    impactAt: -10,
    lastStamp: 0,
    stampStart: -10,
    lastClick: 0,
    clickStart: -10,
    time: 0,
    first: true,
    frames: 0,
    readySent: false,
  });
  const notchOff = palette["--ic-gold-900"];
  const notchOn = palette["--ic-gold-100"];
  const notchColor = useMemo(() => new Color(), []);

  const mats = useMemo(
    () => ({
      halo: new SpriteMaterial({
        map: textures.halo,
        color: theme === "aegean" ? palette["--ic-sky"] : palette["--ic-gold-500"],
        transparent: true,
        opacity: 0.22,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
      glints: GLINT_ANGLES.map(
        () =>
          new SpriteMaterial({
            map: textures.glint,
            color: palette["--ic-gold-100"],
            transparent: true,
            opacity: 0,
            blending: AdditiveBlending,
            depthWrite: false,
            depthTest: false,
          }),
      ),
      chrome: new MeshStandardMaterial({ color: palette["--ic-chrome"], metalness: 1, roughness: 0.08 }),
    }),
    [palette, theme, textures.halo, textures.glint],
  );
  useEffect(
    () => () => {
      mats.halo.dispose();
      mats.chrome.dispose();
      mats.glints.forEach((m) => m.dispose());
    },
    [mats],
  );

  // Still tier renders on demand: ask for a few frames whenever something changes.
  useEffect(() => {
    if (!still) return;
    live.current.first = true;
    let n = 0;
    const id = window.setInterval(() => {
      invalidate();
      if (++n > 6) window.clearInterval(id);
    }, 60);
    return () => window.clearInterval(id);
  }, [still, invalidate, textures.heads, textures.tails, palette]);

  // The page shows an HTML coin until this one has drawn with its face on.
  useEffect(() => () => useStage.getState().setReady(false), []);

  useFrame((state, rawDelta) => {
    const parts = coin.current;
    if (!parts) return;
    if (!live.current.readySent && textures.heads && ++live.current.frames > 2) {
      live.current.readySent = true;
      useStage.getState().setReady(true);
    }
    const dt = Math.min(rawDelta, 1 / 20);
    const L = live.current;
    L.time += dt;

    // View size in world units at the coin's depth (z = 0).
    const cam = state.camera as PerspectiveCamera;
    const halfH = cam.position.z * Math.tan((cam.fov * Math.PI) / 360);
    const aspect = state.size.width / Math.max(1, state.size.height);
    const halfW = halfH * aspect;
    const narrow = isNarrow(state.size.width, state.size.height);
    const unit = Math.min(halfW * 0.8, halfH * 0.5);

    // 1. Where the coin should be.
    if (still) {
      copyPose(narrow ? STILL_POSE.narrow : STILL_POSE.wide, target);
    } else {
      const i = activeChapter(motion.entered);
      const p = tier === "lite" ? (i === 0 ? 0 : 1) : motion.progress[i];
      samplePose(i, p, narrow, target);
    }

    // 2. Spin on the edge, settling face-on as the chapter asks.
    L.spin += target.spin * dt;
    const face = Math.round(L.spin / TAU) * TAU;
    const settle = target.settle * target.settle * (3 - 2 * target.settle);
    if (target.settle > 0.995) L.spin = face;
    const ry = L.spin + (face - L.spin) * settle + target.flip * Math.PI;

    // 2b. User click-and-drag inertia & click-to-flip response.
    if (!motion.isDraggingCoin) {
      if (Math.abs(motion.userVelY) > 0.005) {
        motion.userRotY += motion.userVelY * dt;
        motion.userVelY *= Math.exp(-4.2 * dt);
      } else {
        motion.userVelY = 0;
      }
      motion.userRotX *= Math.exp(-3.5 * dt);
    }

    if (motion.coinClickAt !== L.lastClick) {
      L.lastClick = motion.coinClickAt;
      L.clickStart = L.time;
    }
    const sinceClick = L.time - L.clickStart;
    const clickPop = sinceClick >= 0 && sinceClick < 0.38 ? Math.sin((sinceClick / 0.38) * Math.PI) : 0;

    // 3. One sharp impact: the coin rings and wobbles to rest after the drop.
    const sinceImpact = L.time - L.impactAt;
    const wobble = sinceImpact < 2.5 ? Math.exp(-sinceImpact * 2.6) * Math.sin(sinceImpact * 22) : 0;

    // 4. A wax-seal stamp for each past night.
    if (motion.stampAt !== L.lastStamp) {
      L.lastStamp = motion.stampAt;
      L.stampStart = L.time;
    }
    const k = (L.time - L.stampStart) / 0.45;
    const stamp = k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0;

    const px = full ? motion.pointerX : 0;
    const py = full ? motion.pointerY : 0;
    const root = parts.root;
    const tx = target.x * halfW;
    const ty = target.y * halfH;
    const ts = target.s * unit * (1 - stamp * 0.16 + clickPop * 0.06);
    const trx = target.rx + motion.userRotX + py * 0.08 + wobble * 0.05;
    const trz = target.rz + wobble * 0.12 + stamp * 0.1;
    const tRy = ry + motion.userRotY + px * 0.12;

    if (still || L.first) {
      root.position.set(tx, ty, target.z);
      root.rotation.set(trx, tRy, trz);
      root.scale.setScalar(ts);
      L.flute = target.flute;
      L.notches = target.notches;
      L.awake = target.awake;
      L.first = false;
    } else {
      const rotDamp = motion.isDraggingCoin ? 0.05 : 0.16;
      easing.damp(root.position, "x", tx, 0.35, dt);
      easing.damp(root.position, "y", ty, 0.35, dt);
      easing.damp(root.position, "z", target.z, 0.35, dt);
      easing.damp(root.rotation, "x", trx, rotDamp, dt);
      easing.damp(root.rotation, "y", tRy, rotDamp, dt);
      easing.damp(root.rotation, "z", trz, 0.3, dt);
      easing.damp(root.scale, "x", ts, 0.25, dt);
      root.scale.y = root.scale.x;
      root.scale.z = root.scale.x;
      easing.damp(L, "flute", target.flute, 0.4, dt);
      easing.damp(L, "notches", target.notches, 0.15, dt);
      easing.damp(L, "awake", target.awake, 0.4, dt);
    }

    // Update screen-space hit-test bounds for click/drag rotation.
    motion.coinScreenX = (0.5 + root.position.x / Math.max(0.001, 2 * halfW)) * state.size.width;
    motion.coinScreenY = (0.5 - root.position.y / Math.max(0.001, 2 * halfH)) * state.size.height;
    motion.coinScreenR = (root.scale.x / Math.max(0.001, 2 * halfH)) * state.size.height;

    // Followers: halo, chrome rings, flute.
    follower.current.position.copy(root.position);
    follower.current.scale.copy(root.scale);
    if (full) {
      halo.current.visible = true;
      mats.halo.opacity = 0.2 + stamp * 0.1 + clickPop * 0.18 + (sinceImpact < 1 ? (1 - sinceImpact) * 0.25 : 0);
    } else {
      halo.current.visible = false;
    }
    if (chrome.current) {
      chrome.current.visible = theme === "aegean";
      if (!still) chrome.current.rotation.x += dt * 0.2;
    }

    const f = flute.current;
    if (f) {
      const level = still ? 0 : L.flute;
      f.setLevel(level);
      // Stand along the up-facing side's normal: the tails side after a half flip.
      f.root.position.copy(root.position);
      f.root.rotation.set(root.rotation.x + Math.PI / 2, 0, root.rotation.z);
      const rise = (1 - level) * 1.6;
      f.root.scale.copy(root.scale);
      f.root.translateY((0.08 - rise) * root.scale.x);
    }

    // Rim notches: they light one by one through chapter 4.
    const n = L.notches;
    parts.notches.visible = n > 0.01;
    if (parts.notches.visible) {
      for (let j = 0; j < NOTCH_COUNT; j++) {
        const lit = Math.min(1, Math.max(0, n * NOTCH_COUNT - j));
        notchColor.copy(notchOff).lerp(notchOn, lit);
        parts.notches.setColorAt(j, notchColor);
      }
      if (parts.notches.instanceColor) parts.notches.instanceColor.needsUpdate = true;
    }

    // Goldie waking up and expressing presence states (idle, listening, thinking, speaking, celebrating, hushed, sorry).
    // Keep the 3D overlay meshes hidden when awake === 0 so Logo.jpg is 100% crisp and unobstructed on the main home page.
    const gState = useStage.getState().goldieState;
    const awake = Math.max(L.awake, gState !== "idle" ? 1 : 0);
    const showOverlay = awake > 0.02;
    parts.dome.visible = showOverlay;
    parts.eyes[0].visible = showOverlay;
    parts.eyes[1].visible = showOverlay;
    parts.smile.visible = showOverlay;
    parts.tongue.visible = showOverlay;

    if (gState === "hushed") {
      parts.onyxMaterial.emissiveIntensity = 0.02;
    } else if (gState === "celebrating") {
      parts.onyxMaterial.emissiveIntensity = 0.25;
      if (!still) L.spin += dt * 4.5;
    } else if (gState === "thinking") {
      parts.onyxMaterial.emissiveIntensity = 0.16;
      if (!still) L.spin += dt * 5.2;
    } else {
      parts.onyxMaterial.emissiveIntensity = awake * 0.12;
    }

    if (!still && showOverlay) {
      if (gState === "speaking") {
        parts.tongue.rotation.x = 0.22 + Math.abs(Math.sin(L.time * 14)) * 0.52;
        parts.eyes[0].scale.set(1, 1, 1);
        parts.eyes[1].scale.set(1, 1, 1);
        parts.eyes[0].rotation.z = 0;
        parts.eyes[1].rotation.z = 0;
      } else if (gState === "listening") {
        parts.tongue.rotation.x = 0.18;
        const pulse = 1.12 + Math.sin(L.time * 6) * 0.06;
        parts.eyes[0].scale.set(pulse, pulse * 1.15, 1);
        parts.eyes[1].scale.set(pulse, pulse * 1.15, 1);
        parts.eyes[0].rotation.z = 0;
        parts.eyes[1].rotation.z = 0;
      } else if (gState === "hushed") {
        parts.tongue.rotation.x = 0.08;
        parts.eyes[0].scale.set(1, 0.14, 1);
        parts.eyes[1].scale.set(1, 0.14, 1);
        parts.eyes[0].rotation.z = 0;
        parts.eyes[1].rotation.z = 0;
      } else if (gState === "sorry") {
        parts.tongue.rotation.x = 0.12;
        parts.eyes[0].scale.set(0.95, 0.7, 1);
        parts.eyes[1].scale.set(0.95, 0.7, 1);
        parts.eyes[0].rotation.z = 0.18;
        parts.eyes[1].rotation.z = -0.18;
      } else {
        const period = awake > 0.5 ? 2.6 : 6;
        const t = L.time % period;
        const flick = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : 0;
        parts.tongue.rotation.x = 0.25 + flick * (0.35 + awake * 0.3);
        const blinkT = (L.time + 1.3) % 4.2;
        const blink = blinkT < 0.16 ? 1 - Math.sin((blinkT / 0.16) * Math.PI) * 0.8 : 1;
        parts.eyes[0].scale.set(1, blink, 1);
        parts.eyes[1].scale.set(1, blink, 1);
        parts.eyes[0].rotation.z = 0;
        parts.eyes[1].rotation.z = 0;
      }
    }

    // Glints sweep the rim in turn (Full only) and flash when clicked.
    for (let j = 0; j < glints.current.length; j++) {
      const g = glints.current[j];
      if (!g) continue;
      if (!full && clickPop <= 0.01) {
        g.visible = false;
        continue;
      }
      const cycle = (L.time + j * 1.1) % 3.3;
      const a = Math.max(clickPop, cycle < 0.7 ? Math.sin((cycle / 0.7) * Math.PI) : 0);
      g.visible = a > 0.01;
      g.scale.setScalar(0.08 + a * 0.3);
      g.material.opacity = a;
    }
  });

  const onImpact = () => {
    live.current.impactAt = live.current.time;
  };

  return (
    <group>
      <group ref={follower}>
        <sprite ref={halo} material={mats.halo} scale={[3.6, 3.6, 1]} position={[0, 0, -0.6]} renderOrder={-1} />
        <group ref={chrome} visible={false}>
          <mesh material={mats.chrome}>
            <torusGeometry args={[1.34, 0.011, 8, 128]} />
          </mesh>
          <mesh material={mats.chrome} rotation={[0.35, 0.2, 0]}>
            <torusGeometry args={[1.52, 0.006, 6, 128]} />
          </mesh>
        </group>
      </group>
      <Coin
        ref={coin}
        palette={palette}
        heads={textures.heads}
        tails={textures.tails}
        edgeBump={textures.edge}
        detail={tier === "full" ? "high" : "low"}
      />
      <CoinGlints coin={coin} glints={glints} materials={mats.glints} />
      {tier === "still" ? null : <Flute ref={flute} palette={palette} splash onImpact={onImpact} />}
    </group>
  );
}

/** Three glint sprites parented to the coin's root, sitting on its rim. */
function CoinGlints({
  coin,
  glints,
  materials,
}: {
  coin: React.RefObject<CoinParts | null>;
  glints: React.RefObject<Sprite[]>;
  materials: SpriteMaterial[];
}) {
  const holder = useRef<Group>(null!);
  useEffect(() => {
    const root = coin.current?.root;
    const g = holder.current;
    if (!root || !g) return;
    root.add(g); // ride along with the coin's rotation
    return () => {
      root.remove(g);
    };
  }, [coin]);
  return (
    <group ref={holder}>
      {GLINT_ANGLES.map((a, i) => (
        <sprite
          key={i}
          ref={(s) => {
            if (s) glints.current[i] = s;
          }}
          material={materials[i]}
          position={[Math.cos(a) * 0.93, Math.sin(a) * 0.93, 0.1]}
          visible={false}
        />
      ))}
    </group>
  );
}
