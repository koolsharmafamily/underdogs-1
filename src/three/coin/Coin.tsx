"use client";
/*
  The procedural coin, until a GLB from the vector logo replaces it.
  Built with its face toward +Z. Radius 1, thickness about 0.16.

  Separate meshes (so Goldie can move them): the onyx dome, two X eyes,
  the smile and the tongue. The six rim notches (chapter 4) are one
  InstancedMesh. To swap in a GLB later, keep the CoinParts contract.
*/
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
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
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  type Texture,
} from "three";
import type { Palette } from "../colors";
import { LOGO_FACE } from "./textures";

export const COIN_HALF_THICKNESS = 0.066;
const FACE_Z = 0.062;
const DOME = { base: LOGO_FACE.onyx, height: 0.13 };
const DOME_R = (DOME.base ** 2 + DOME.height ** 2) / (2 * DOME.height);
const DOME_CENTRE_Z = FACE_Z + DOME.height - DOME_R;
const BEADS_PER_SIDE = 110;
export const NOTCH_COUNT = 6;

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
  const dome = useRef<Mesh>(null!);
  const eyeL = useRef<Group>(null!);
  const eyeR = useRef<Group>(null!);
  const smile = useRef<Mesh>(null!);
  const tongue = useRef<Group>(null!);
  const notches = useRef<InstancedMesh>(null!);
  const beads = useRef<InstancedMesh>(null!);

  const seg = detail === "high" ? 128 : 64;

  const geo = useMemo(() => {
    // Rim: a lathe profile with a raised lip on both faces and a flat milled edge.
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

    // One arm of an X: a four-sided prism, so the flat-shaded gold reads as faceted.
    const arm = new CylinderGeometry(0.034, 0.034, 0.24, 4, 1);
    arm.rotateY(Math.PI / 4);
    arm.scale(1, 1, 0.8);

    // The smile: a crescent, flat on top and deep underneath, like the logo's.
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
    tongueGeo.translate(0, -0.08, 0); // pivot at the top, so it can flick

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
        envMapIntensity: 0.35, // one crisp highlight, not a grey slab
      }),
      notch: new MeshBasicMaterial({ color: palette["--ic-gold-900"], toneMapped: false, side: DoubleSide }),
    };
  }, [palette, edgeBump]);

  // Photo and drawn textures arrive asynchronously.
  useEffect(() => {
    // The photo is both the metal's colour and a little baked light, so the logo's gold reads true.
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

  // Beads around both lips, and the notches around the ring face: placed once.
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
      const a = Math.PI / 2 - (i / NOTCH_COUNT) * Math.PI * 2; // from the top, clockwise
      dummy.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, FACE_Z + 0.012);
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

  useImperativeHandle(ref, () => ({
    root: root.current,
    dome: dome.current,
    eyes: [eyeL.current, eyeR.current] as [Group, Group],
    smile: smile.current,
    tongue: tongue.current,
    notches: notches.current,
    onyxMaterial: mat.onyx,
    notchMaterial: mat.notch,
  }));

  const eye = (x: number) => {
    const y = LOGO_FACE.eyeY;
    const z = domeZ(x, y) + 0.012;
    // Lean each eye with the dome's surface.
    const nx = x / DOME_R;
    const ny = y / DOME_R;
    return { position: [x, y, z] as const, rotation: [-Math.asin(ny), Math.asin(nx), 0] as const };
  };
  const left = eye(-LOGO_FACE.eyeX);
  const right = eye(LOGO_FACE.eyeX);

  return (
    <group ref={root}>
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

      <instancedMesh ref={notches} args={[geo.notch, mat.notch, NOTCH_COUNT]} />
    </group>
  );
});
