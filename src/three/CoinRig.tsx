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
  PointLight,
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
  const follower = useRef<Group>(null!); // follows the coin's position with trailing lag
  const halo = useRef<Sprite>(null!);
  const glints = useRef<Sprite[]>([]);
  const chrome = useRef<Group>(null!);
  const specLight = useRef<PointLight>(null!);
  const rimLight = useRef<PointLight>(null!);
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
    const dt = Math.min(rawDelta, 1 / 20);
    const L = live.current;
    L.time += dt;

    const canReveal = parts.glbLoaded || (textures.heads && L.time > 1.8);
    if (!L.readySent && canReveal && ++L.frames > 3) {
      L.readySent = true;
      useStage.getState().setReady(true);
    }

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

    // 5. Dual-horizon exponential cursor lag (0.42s primary tilt lag, 0.75s secondary drift lag).
    if (still) {
      motion.smoothPointerX = 0;
      motion.smoothPointerY = 0;
      motion.lagPointerX = 0;
      motion.lagPointerY = 0;
      motion.pointerVelX = 0;
      motion.pointerVelY = 0;
    } else {
      easing.damp(motion, "smoothPointerX", motion.pointerX, 0.42, dt);
      easing.damp(motion, "smoothPointerY", motion.pointerY, 0.42, dt);
      easing.damp(motion, "lagPointerX", motion.smoothPointerX, 0.75, dt);
      easing.damp(motion, "lagPointerY", motion.smoothPointerY, 0.75, dt);
      motion.pointerVelX = motion.pointerX - motion.smoothPointerX;
      motion.pointerVelY = motion.pointerY - motion.smoothPointerY;
    }

    // Continuous organic Lissajous micro-float so the coin breathes even when cursor rests.
    const floatX = still ? 0 : Math.cos(L.time * 0.7) * 0.015;
    const floatY = still ? 0 : Math.sin(L.time * 1.1) * 0.022;
    const floatRx = still ? 0 : Math.sin(L.time * 0.9) * 0.025;

    const root = parts.root;
    const tx = target.x * halfW + (still ? 0 : motion.lagPointerX * halfW * 0.085 + floatX);
    const ty = target.y * halfH + (still ? 0 : -motion.lagPointerY * halfH * 0.085 + floatY);
    const tz =
      target.z +
      (still ? 0 : (1 - Math.min(1, Math.hypot(motion.smoothPointerX, motion.smoothPointerY) * 0.5)) * 0.12);
    const ts = target.s * unit * (1 - stamp * 0.16 + clickPop * 0.06);

    // 3D Gyroscopic Look-At Tilt & Velocity Roll/Bank
    const trx = target.rx + (still ? 0 : -motion.smoothPointerY * 0.34 + floatRx) + motion.userRotX + wobble * 0.05;
    const tRy = ry + (still ? 0 : motion.smoothPointerX * 0.46) + motion.userRotY;
    const trz =
      target.rz +
      (still ? 0 : -motion.pointerVelX * 0.18 - motion.smoothPointerX * 0.06) +
      wobble * 0.12 +
      stamp * 0.1;

    if (still || L.first) {
      root.position.set(tx, ty, tz);
      root.rotation.set(trx, tRy, trz);
      root.scale.setScalar(ts);
      follower.current.position.set(tx, ty, tz);
      follower.current.scale.setScalar(ts);
      L.flute = target.flute;
      L.notches = target.notches;
      L.awake = target.awake;
      L.first = false;
    } else {
      const rotDamp = motion.isDraggingCoin ? 0.06 : 0.38;
      easing.damp(root.position, "x", tx, 0.55, dt);
      easing.damp(root.position, "y", ty, 0.55, dt);
      easing.damp(root.position, "z", tz, 0.55, dt);
      easing.damp(root.rotation, "x", trx, rotDamp, dt);
      easing.damp(root.rotation, "y", tRy, rotDamp, dt);
      easing.damp(root.rotation, "z", trz, 0.42, dt);
      easing.damp(root.scale, "x", ts, 0.28, dt);
      root.scale.y = root.scale.x;
      root.scale.z = root.scale.x;
      easing.damp(L, "flute", target.flute, 0.4, dt);
      easing.damp(L, "notches", target.notches, 0.15, dt);
      easing.damp(L, "awake", target.awake, 0.4, dt);

      // Trailing parallax lag on the back-glow halo & follower group.
      easing.damp(follower.current.position, "x", root.position.x - motion.lagPointerX * 0.08, 0.65, dt);
      easing.damp(follower.current.position, "y", root.position.y + motion.lagPointerY * 0.08, 0.65, dt);
      easing.damp(follower.current.position, "z", root.position.z, 0.65, dt);
      follower.current.scale.copy(root.scale);
    }

    // Smooth responsive camera dolly & multi-layered holographic parallax
    const baseCamZ = narrow ? 7.1 : 6.2;
    const camTargetX = still ? 0 : motion.smoothPointerX * (narrow ? 0.16 : 0.26);
    const camTargetY = still ? 0 : -motion.smoothPointerY * (narrow ? 0.12 : 0.2);
    const camTargetZ = baseCamZ + (still ? 0 : Math.hypot(motion.smoothPointerX, motion.smoothPointerY) * 0.2);
    easing.damp(cam.position, "x", camTargetX, 0.65, dt);
    easing.damp(cam.position, "y", camTargetY, 0.65, dt);
    easing.damp(cam.position, "z", camTargetZ, 0.65, dt);

    // Independent animations across the 3 distinct mesh groups:
    // (1) Outer Gold Ring: responds to velocity roll and drag momentum
    if (parts.outerRing) {
      const ringRoll = -motion.pointerVelX * 0.12;
      easing.damp(parts.outerRing.rotation, "z", ringRoll, 0.45, dt);
    }

    // (2) Inner Black Disc: subtle depth breathing and micro counter-parallax
    if (parts.innerDisc) {
      const discCounterRoll = motion.smoothPointerX * 0.04;
      const discDepth = Math.sin(L.time * 2.2) * 0.003;
      easing.damp(parts.innerDisc.rotation, "z", discCounterRoll, 0.5, dt);
      easing.damp(parts.innerDisc.position, "z", discDepth, 0.5, dt);
    }

    // (3) Face Elements (eyes + mouth + tongue): micro-tilt towards cursor for 3D pop, plus click bounce
    if (parts.faceElements) {
      const faceTiltX = -motion.smoothPointerY * 0.08;
      const faceTiltY = motion.smoothPointerX * 0.08;
      const facePopZ = clickPop * 0.025;
      easing.damp(parts.faceElements.rotation, "x", faceTiltX, 0.4, dt);
      easing.damp(parts.faceElements.rotation, "y", faceTiltY, 0.4, dt);
      easing.damp(parts.faceElements.position, "z", facePopZ, 0.4, dt);
    }

    // Micro-animations for the bespoke 3D GLB face elements
    if (parts.glbEyes) {
      const blinkT = (L.time + 1.3) % 4.2;
      const blink = blinkT < 0.16 ? 1 - Math.sin((blinkT / 0.16) * Math.PI) * 0.85 : 1;
      easing.damp(parts.glbEyes.scale, "y", blink, 0.15, dt);
    }
    if (parts.glbTongue) {
      const period = 5.4;
      const t = L.time % period;
      const flick = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : 0;
      const tongueRotX = flick * 0.28;
      easing.damp(parts.glbTongue.rotation, "x", tongueRotX, 0.2, dt);
    }

    // Dynamic specular highlight light gliding across the coin surface with smoothed cursor lag.
    if (specLight.current) {
      const specX = root.position.x + motion.smoothPointerX * 1.85;
      const specY = root.position.y - motion.smoothPointerY * 1.55;
      const specZ = root.position.z + 2.45;
      easing.damp(specLight.current.position, "x", specX, 0.48, dt);
      easing.damp(specLight.current.position, "y", specY, 0.48, dt);
      easing.damp(specLight.current.position, "z", specZ, 0.48, dt);
      const targetIntensity =
        2.4 + clickPop * 1.6 + Math.min(1.5, Math.hypot(motion.pointerVelX, motion.pointerVelY) * 2.2);
      easing.damp(specLight.current, "intensity", targetIntensity, 0.35, dt);
    }

    // Dynamic metallic rim light enhancing edge glints
    if (rimLight.current) {
      const rimX = root.position.x - motion.smoothPointerX * 2.2;
      const rimY = root.position.y + motion.smoothPointerY * 1.8;
      const rimZ = root.position.z + 1.4;
      easing.damp(rimLight.current.position, "x", rimX, 0.55, dt);
      easing.damp(rimLight.current.position, "y", rimY, 0.55, dt);
      easing.damp(rimLight.current.position, "z", rimZ, 0.55, dt);
      const rimIntensity = 1.3 + Math.hypot(motion.smoothPointerX, motion.smoothPointerY) * 0.8;
      easing.damp(rimLight.current, "intensity", rimIntensity, 0.35, dt);
    }

    // Update screen-space hit-test bounds for click/drag rotation.
    motion.coinScreenX = (0.5 + root.position.x / Math.max(0.001, 2 * halfW)) * state.size.width;
    motion.coinScreenY = (0.5 - root.position.y / Math.max(0.001, 2 * halfH)) * state.size.height;
    motion.coinScreenR = (root.scale.x / Math.max(0.001, 2 * halfH)) * state.size.height;

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

    // Keep fallback overlay meshes hidden so the bespoke 3D GLB coin remains 100% clean and unobstructed.
    parts.dome.visible = false;
    parts.eyes[0].visible = false;
    parts.eyes[1].visible = false;
    parts.smile.visible = false;
    parts.tongue.visible = false;

    // Glints sweep the rim in turn, react to cursor velocity, and flash when clicked.
    const cursorSweep = Math.min(0.85, Math.hypot(motion.pointerVelX, motion.pointerVelY) * 1.35);
    for (let j = 0; j < glints.current.length; j++) {
      const g = glints.current[j];
      if (!g) continue;
      if (!full && clickPop <= 0.01 && cursorSweep <= 0.05) {
        g.visible = false;
        continue;
      }
      const cycle = (L.time + j * 1.1 + motion.smoothPointerX * 0.8) % 3.3;
      const baseGlint = cycle < 0.7 ? Math.sin((cycle / 0.7) * Math.PI) : 0;
      const a = Math.max(clickPop, baseGlint, j === 0 ? cursorSweep : cursorSweep * 0.55);
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
      <pointLight
        ref={specLight}
        color={palette["--ic-gold-100"]}
        intensity={2.6}
        distance={9}
        decay={1.6}
        position={[0, 0, 2.4]}
      />
      <pointLight
        ref={rimLight}
        color={palette["--ic-gold-bright"]}
        intensity={1.8}
        distance={10}
        decay={1.8}
        position={[0, 0, 1.4]}
      />
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
