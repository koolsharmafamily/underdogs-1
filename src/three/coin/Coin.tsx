"use client";
/*
  Loads the bespoke 3D Underdogs Coin model (/models/coin-3d.glb) via Three.js
  GLTFLoader, normalized to unit radius (1.0) with its front face toward +Z.
  Keeps a lightweight procedural fallback visible for the first few frames while
  the GLB streams in, and exposes the CoinParts contract so CoinRig can drive
  rotation, position, scale, rim notches, and Goldie's animated expressions.
*/
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Palette } from "../colors";
import { LOGO_FACE } from "./textures";

export const COIN_HALF_THICKNESS = 0.07;
const FACE_Z = 0.062;
const GLB_NATIVE_RADIUS = 19.950916290283203;
const GLB_UNIT_SCALE = 1 / GLB_NATIVE_RADIUS;
const DOME = { base: LOGO_FACE.onyx, height: 0.13 };
const DOME_R = (DOME.base ** 2 + DOME.height ** 2) / (2 * DOME.height);
const DOME_CENTRE_Z = FACE_Z + DOME.height - DOME_R;
const BEADS_PER_SIDE = 110;
export const NOTCH_COUNT = 6;

let cachedGlbPromise: Promise<GLTF> | null = null;
function loadCoinGlb(): Promise<GLTF> {
  if (!cachedGlbPromise) {
    const loader = new GLTFLoader();
    cachedGlbPromise = new Promise<GLTF>((resolve, reject) => {
      loader.load("/models/coin-3d.glb", resolve, undefined, reject);
    });
  }
  return cachedGlbPromise;
}

/** Height of the dome's surface above (x, y), in coin space. */
function domeZ(x: number, y: number) {
  return DOME_CENTRE_Z + Math.sqrt(Math.max(0, DOME_R * DOME_R - x * x - y * y));
}

export type CoinParts = {
  root: Group;
  dome: Mesh;
  eyes: [Group, Group];
  smile: Mesh;
  tongue: Group;
  notches: InstancedMesh;
  onyxMaterial: MeshPhysicalMaterial;
  notchMaterial: MeshBasicMaterial;
  glbLoaded: boolean;
  glbEyes: Group | null;
  glbTongue: Group | null;
  outerRing: Group | null;
  innerDisc: Group | null;
  faceElements: Group | null;
};

type Props = {
  palette: Palette;
  heads: { map: Texture; bump: Texture } | null;
  tails: { map: Texture; bump: Texture } | null;
  edgeBump: Texture;
  /** Fewer segments on Lite. */
  detail: "high" | "low";
};

export const Coin = forwardRef<CoinParts, Props>(function Coin({ palette, heads, tails, edgeBump, detail }, ref) {
  const root = useRef<Group>(null!);
  const glbHolder = useRef<Group>(null!);
  const fallbackHolder = useRef<Group>(null!);
  const dome = useRef<Mesh>(null!);
  const eyeL = useRef<Group>(null!);
  const eyeR = useRef<Group>(null!);
  const smile = useRef<Mesh>(null!);
  const tongue = useRef<Group>(null!);
  const notches = useRef<InstancedMesh>(null!);
  const beads = useRef<InstancedMesh>(null!);

  const outerRingRef = useRef<Group | null>(null);
  const innerDiscRef = useRef<Group | null>(null);
  const faceElementsRef = useRef<Group | null>(null);
  const glbEyesRef = useRef<Group | null>(null);
  const glbTongueRef = useRef<Group | null>(null);
  const [glbReady, setGlbReady] = useState(false);

  const seg = detail === "high" ? 128 : 64;

  const geo = useMemo(() => {
    const profile = [
      [0.94, FACE_Z - 0.002],
      [0.952, 0.078],
      [0.985, 0.081],
      [1.0, COIN_HALF_THICKNESS],
      [1.0, -COIN_HALF_THICKNESS],
      [0.985, -0.081],
      [0.952, -0.078],
      [0.94, -FACE_Z + 0.002],
    ].map(([r, y]) => new Vector2(r, y));
    const rim = new LatheGeometry(profile, seg);
    rim.rotateX(Math.PI / 2);

    const face = new CircleGeometry(0.955, seg);
    const bead = new SphereGeometry(0.0115, 6, 4);

    const domeGeo = new SphereGeometry(DOME_R, seg, 20, 0, Math.PI * 2, 0, Math.asin(DOME.base / DOME_R));
    domeGeo.rotateX(Math.PI / 2);
    domeGeo.translate(0, 0, DOME_CENTRE_Z);

    const arm = new CylinderGeometry(0.034, 0.034, 0.24, 4, 1);
    arm.rotateY(Math.PI / 4);
    arm.scale(1, 1, 0.8);

    const s = new Shape();
    s.moveTo(-0.25, 0);
    s.quadraticCurveTo(0, -0.05, 0.25, 0);
    s.quadraticCurveTo(0.22, -0.2, 0, -0.23);
    s.quadraticCurveTo(-0.22, -0.2, -0.25, 0);
    const smileGeo = new ExtrudeGeometry(s, {
      depth: 0.025,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
      curveSegments: detail === "high" ? 24 : 12,
    });

    const tongueGeo = new CapsuleGeometry(0.085, 0.07, 6, detail === "high" ? 20 : 12);
    tongueGeo.scale(1, 1, 0.42);
    tongueGeo.translate(0, -0.08, 0);

    const notch = new CylinderGeometry(0.018, 0.018, 0.1, 6);
    notch.rotateX(Math.PI / 2);
    notch.scale(1, 1.4, 0.25);

    return { rim, face, bead, domeGeo, arm, smileGeo, tongueGeo, notch };
  }, [seg, detail]);

  const mat = useMemo(() => {
    const neutralWhite = palette["--ic-ivory"].clone().setRGB(1, 1, 1);
    const gold = (p: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) =>
      new MeshPhysicalMaterial({ color: palette["--ic-gold-100"], metalness: 0.78, roughness: 0.24, ...p });
    return {
      edge: gold({
        color: palette["--ic-gold-100"],
        metalness: 0.75,
        roughness: 0.25,
        emissive: palette["--ic-gold-300"],
        emissiveIntensity: 0.26,
        bumpMap: edgeBump,
        bumpScale: 2.2,
      }),
      bead: gold({
        color: palette["--ic-gold-100"],
        metalness: 0.72,
        roughness: 0.18,
        emissive: palette["--ic-gold-300"],
        emissiveIntensity: 0.24,
        envMapIntensity: 1.3,
      }),
      heads: new MeshPhysicalMaterial({
        color: neutralWhite,
        metalness: 0.35,
        roughness: 0.26,
        clearcoat: 0.35,
        clearcoatRoughness: 0.18,
        emissive: neutralWhite,
        emissiveIntensity: 0.52,
        envMapIntensity: 0.95,
      }),
      tails: new MeshPhysicalMaterial({
        color: neutralWhite,
        metalness: 0.38,
        roughness: 0.26,
        clearcoat: 0.35,
        clearcoatRoughness: 0.18,
        emissive: neutralWhite,
        emissiveIntensity: 0.48,
        envMapIntensity: 1.0,
      }),
      facet: gold({
        color: palette["--ic-gold-100"],
        metalness: 0.7,
        roughness: 0.16,
        emissive: palette["--ic-gold-300"],
        emissiveIntensity: 0.25,
        flatShading: true,
      }),
      polished: gold({
        color: palette["--ic-gold-100"],
        metalness: 0.72,
        roughness: 0.14,
        emissive: palette["--ic-gold-300"],
        emissiveIntensity: 0.22,
      }),
      onyx: new MeshPhysicalMaterial({
        color: palette["--ic-void"],
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        emissive: palette["--ic-gold-700"],
        emissiveIntensity: 0,
        envMapIntensity: 0.35,
      }),
      notch: new MeshBasicMaterial({ color: palette["--ic-gold-900"], toneMapped: false, side: DoubleSide }),
    };
  }, [palette, edgeBump]);

  // Load and mount /models/coin-3d.glb via Three.js GLTFLoader.
  useEffect(() => {
    let alive = true;
    const holder = glbHolder.current;
    const clonedMaterials: MeshStandardMaterial[] = [];

    // Load 2K PBR texture maps
    const texLoader = new TextureLoader();
    const baseColorMap = texLoader.load("/models/textures/coin_base_color_2k.png");
    baseColorMap.colorSpace = SRGBColorSpace;
    baseColorMap.wrapS = RepeatWrapping;
    baseColorMap.wrapT = RepeatWrapping;

    const pbrMap = texLoader.load("/models/textures/coin_metallic_roughness_2k.png");
    pbrMap.wrapS = RepeatWrapping;
    pbrMap.wrapT = RepeatWrapping;

    const normalMap = texLoader.load("/models/textures/coin_normal_2k.png");
    normalMap.wrapS = RepeatWrapping;
    normalMap.wrapT = RepeatWrapping;

    loadCoinGlb()
      .then((gltf) => {
        if (!alive || !holder) return;
        const clonedScene = gltf.scene.clone(true);
        const coinNode = clonedScene.getObjectByName("underdogs_coin") ?? clonedScene;

        // Reset export transform so the GLB has exact unit radius (1.0) centered at origin (0, 0, 0).
        coinNode.matrixAutoUpdate = true;
        coinNode.position.set(0, 0, 0);
        coinNode.rotation.set(0, 0, 0);
        coinNode.scale.setScalar(GLB_UNIT_SCALE);
        coinNode.updateMatrix();

        // Cache the 3 distinct mesh groups so they can be animated independently:
        // (1) outer_gold_ring
        // (2) inner_black_disc
        // (3) face_elements
        const outer = (coinNode.getObjectByName("outer_gold_ring") as Group) || null;
        const inner = (coinNode.getObjectByName("inner_black_disc") as Group) || null;
        const face = (coinNode.getObjectByName("face_elements") as Group) || null;

        outerRingRef.current = outer;
        innerDiscRef.current = inner;
        faceElementsRef.current = face;

        // Calibrate the GLB materials with 2K PBR textures to match the brand champagne-gold tokens.
        coinNode.traverse((obj) => {
          if (!(obj instanceof Mesh)) return;
          const origMat = obj.material as MeshStandardMaterial | undefined;
          if (!origMat) return;

          if (origMat.name === "enamel_black" || obj.name.includes("enamel") || obj.name.includes("disc")) {
            mat.onyx.normalMap = normalMap;
            mat.onyx.normalScale.set(0.12, 0.12);
            mat.onyx.needsUpdate = true;
            obj.material = mat.onyx;
            return;
          }

          const m = origMat.clone();
          clonedMaterials.push(m);

          if (origMat.name === "gold_polished" || obj.name.includes("eyes") || obj.name.includes("mouth") || obj.name.includes("tongue")) {
            m.color.copy(palette["--ic-gold-100"]);
            m.metalness = 0.82;
            m.roughness = 0.14;
            m.normalMap = normalMap;
            m.normalScale.set(0.2, 0.2);
            m.emissive.copy(palette["--ic-gold-300"]);
            m.emissiveIntensity = 0.24;
            m.envMapIntensity = 1.45;
          } else if (origMat.name === "gold_lettering") {
            m.map = baseColorMap;
            m.roughnessMap = pbrMap;
            m.metalnessMap = pbrMap;
            m.normalMap = normalMap;
            m.normalScale.set(0.3, 0.3);
            m.color.copy(palette["--ic-gold-100"]);
            m.metalness = 0.8;
            m.roughness = 0.3;
            m.emissive.copy(palette["--ic-gold-300"]);
            m.emissiveIntensity = 0.26;
            m.envMapIntensity = 1.3;
          } else {
            // outer_gold_ring core, rim lip, and rim beads
            m.map = baseColorMap;
            m.roughnessMap = pbrMap;
            m.metalnessMap = pbrMap;
            m.normalMap = normalMap;
            m.normalScale.set(0.35, 0.35);
            m.color.copy(palette["--ic-gold-300"]);
            m.metalness = 0.86;
            m.roughness = 0.26;
            m.emissive.copy(palette["--ic-gold-500"]);
            m.emissiveIntensity = 0.18;
            m.envMapIntensity = 1.35;
          }
          m.needsUpdate = true;
          obj.material = m;
        });

        // Wrap `eyes` and `tongue` on face_elements in pivot groups at their natural hinges so Goldie can blink and flick.
        const eyesMesh = coinNode.getObjectByName("eyes");
        if (eyesMesh && eyesMesh.parent) {
          const parent = eyesMesh.parent;
          const pivot = new Group();
          pivot.name = "eyes_pivot";
          pivot.position.set(0, 3.0, 2.19);
          parent.add(pivot);
          eyesMesh.position.set(0, -3.0, -2.19);
          pivot.add(eyesMesh);
          glbEyesRef.current = pivot;
        }

        const tongueMesh = coinNode.getObjectByName("tongue");
        if (tongueMesh && tongueMesh.parent) {
          const parent = tongueMesh.parent;
          const pivot = new Group();
          pivot.name = "tongue_pivot";
          pivot.position.set(0, -2.9, 2.1);
          parent.add(pivot);
          tongueMesh.position.set(0, 2.9, -2.1);
          pivot.add(tongueMesh);
          glbTongueRef.current = pivot;
        }

        holder.clear();
        holder.add(coinNode);
        setGlbReady(true);
      })
      .catch(() => {
        // Fallback procedural coin stays visible if GLB fails to load.
      });

    return () => {
      alive = false;
      holder?.clear();
      for (const m of clonedMaterials) m.dispose();
      baseColorMap.dispose();
      pbrMap.dispose();
      normalMap.dispose();
    };
  }, [palette, mat.onyx]);

  // Photo and drawn textures for the fallback procedural coin.
  useEffect(() => {
    mat.heads.map = heads?.map ?? null;
    mat.heads.emissiveMap = heads?.map ?? null;
    mat.heads.bumpMap = heads?.bump ?? null;
    mat.heads.bumpScale = 0.35;
    mat.heads.needsUpdate = true;
    mat.tails.map = tails?.map ?? null;
    mat.tails.emissiveMap = tails?.map ?? null;
    mat.tails.bumpMap = tails?.bump ?? null;
    mat.tails.bumpScale = 1.6;
    mat.tails.needsUpdate = true;
  }, [mat, heads, tails]);

  // Beads around both lips (fallback), and the 6 rim notches (used on both GLB and fallback): placed once.
  useEffect(() => {
    const m = new Matrix4();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const p = new Vector3();
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < BEADS_PER_SIDE; i++) {
        const a = (i / BEADS_PER_SIDE) * Math.PI * 2;
        p.set(Math.cos(a) * 0.969, Math.sin(a) * 0.969, side === 0 ? 0.082 : -0.082);
        beads.current.setMatrixAt(side * BEADS_PER_SIDE + i, m.compose(p, q, one));
      }
    }
    beads.current.instanceMatrix.needsUpdate = true;

    const dummy = new Object3D();
    for (let i = 0; i < NOTCH_COUNT; i++) {
      const a = Math.PI / 2 - (i / NOTCH_COUNT) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0.105);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      notches.current.setMatrixAt(i, dummy.matrix);
      notches.current.setColorAt(i, palette["--ic-gold-900"]);
    }
    notches.current.instanceMatrix.needsUpdate = true;
    if (notches.current.instanceColor) notches.current.instanceColor.needsUpdate = true;
  }, [palette]);

  useEffect(
    () => () => {
      for (const g of Object.values(geo) as BufferGeometry[]) g.dispose();
      for (const m of Object.values(mat)) m.dispose();
    },
    [geo, mat],
  );

  useImperativeHandle(
    ref,
    () => ({
      root: root.current,
      dome: dome.current,
      eyes: [eyeL.current, eyeR.current] as [Group, Group],
      smile: smile.current,
      tongue: tongue.current,
      notches: notches.current,
      onyxMaterial: mat.onyx,
      notchMaterial: mat.notch,
      glbLoaded: glbReady,
      glbEyes: glbEyesRef.current,
      glbTongue: glbTongueRef.current,
      outerRing: outerRingRef.current,
      innerDisc: innerDiscRef.current,
      faceElements: faceElementsRef.current,
    }),
    [glbReady, mat.onyx, mat.notch],
  );

  const eye = (x: number) => {
    const y = LOGO_FACE.eyeY;
    const z = domeZ(x, y) + 0.012;
    const nx = x / DOME_R;
    const ny = y / DOME_R;
    return { position: [x, y, z] as const, rotation: [-Math.asin(ny), Math.asin(nx), 0] as const };
  };
  const left = eye(-LOGO_FACE.eyeX);
  const right = eye(LOGO_FACE.eyeX);

  return (
    <group ref={root}>
      {/* Bespoke 3D GLB Coin Model (/models/coin-3d.glb) */}
      <group ref={glbHolder} visible={glbReady} />

      {/* Fallback procedural coin shown only until the GLB model finishes loading */}
      <group ref={fallbackHolder} visible={!glbReady}>
        <mesh geometry={geo.rim} material={mat.edge} />
        <mesh geometry={geo.face} material={mat.heads} position={[0, 0, FACE_Z]} />
        <mesh geometry={geo.face} material={mat.tails} position={[0, 0, -FACE_Z]} rotation={[0, Math.PI, 0]} />
        <instancedMesh ref={beads} args={[geo.bead, mat.bead, BEADS_PER_SIDE * 2]} />

        <mesh ref={dome} geometry={geo.domeGeo} material={mat.onyx} visible={false} />
        <group ref={eyeL} position={left.position} rotation={left.rotation} visible={false}>
          <mesh geometry={geo.arm} material={mat.facet} rotation={[0, 0, Math.PI / 4]} />
          <mesh geometry={geo.arm} material={mat.facet} rotation={[0, 0, -Math.PI / 4]} />
        </group>
        <group ref={eyeR} position={right.position} rotation={right.rotation} visible={false}>
          <mesh geometry={geo.arm} material={mat.facet} rotation={[0, 0, Math.PI / 4]} />
          <mesh geometry={geo.arm} material={mat.facet} rotation={[0, 0, -Math.PI / 4]} />
        </group>
        <mesh
          ref={smile}
          geometry={geo.smileGeo}
          material={mat.polished}
          position={[0, LOGO_FACE.smileTop - 0.02, domeZ(0, -0.2) - 0.035]}
          rotation={[0.12, 0, 0]}
          visible={false}
        />
        <group
          ref={tongue}
          position={[0, LOGO_FACE.tongueY + 0.07, domeZ(0, LOGO_FACE.tongueY) + 0.02]}
          rotation={[0.25, 0, 0]}
          visible={false}
        >
          <mesh geometry={geo.tongueGeo} material={mat.polished} />
        </group>
      </group>

      <instancedMesh ref={notches} args={[geo.notch, mat.notch, NOTCH_COUNT]} />
    </group>
  );
});
