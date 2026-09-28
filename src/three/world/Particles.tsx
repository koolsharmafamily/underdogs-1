"use client";
/*
  Background particles for each world, one draw call each.
  - GoldConfetti: gold ribbons drifting down behind the coin (vault).
  - Stars: a twinkling night sky (aegean).
*/
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import type { Palette } from "../colors";

/** A small deterministic random, so the layout is the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function GoldConfetti({ palette, count, animate }: { palette: Palette; count: number; animate: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(0.045, 0.16, 1, 4);
    // A slight twist along each ribbon.
    const pos = g.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getY(i) * 22) * 0.012);
    g.computeVertexNormals();
    return g;
  }, []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: palette["--ic-confetti"],
        metalness: 1,
        roughness: 0.28,
        side: DoubleSide,
      }),
    [palette],
  );
  // Per-ribbon state in flat typed arrays: x, y, z, speed, spin, phase.
  const state = useMemo(() => {
    const r = rng(7);
    const s = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      s[i * 6] = (r() * 2 - 1) * 5.5;
      s[i * 6 + 1] = (r() * 2 - 1) * 3.2;
      s[i * 6 + 2] = -1.5 - r() * 3.5;
      s[i * 6 + 3] = 0.12 + r() * 0.22;
      s[i * 6 + 4] = 0.6 + r() * 1.8;
      s[i * 6 + 5] = r() * Math.PI * 2;
    }
    return s;
  }, [count]);
  const dummy = useMemo(() => new Object3D(), []);
  const time = useRef(0);

  const write = () => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = time.current;
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      dummy.position.set(state[o] + Math.sin(t * 0.6 + state[o + 5]) * 0.18, state[o + 1], state[o + 2]);
      dummy.rotation.set(t * state[o + 4] + state[o + 5], t * state[o + 4] * 0.7, state[o + 5]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(write);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    if (!animate) return;
    time.current += delta;
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      state[o + 1] -= state[o + 3] * delta;
      if (state[o + 1] < -3.4) state[o + 1] = 3.4;
    }
    write();
  });

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />;
}

const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
    vAlpha = 0.45 + 0.55 * sin(uTime * (0.6 + aPhase * 0.5) + aPhase * 6.2831);
  }
`;
const starFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`;

export function Stars({ palette, count, animate, pixelRatio }: { palette: Palette; count: number; animate: boolean; pixelRatio: number }) {
  const geometry = useMemo(() => {
    const r = rng(11);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (r() * 2 - 1) * 9;
      pos[i * 3 + 1] = -1 + r() * 5.5;
      pos[i * 3 + 2] = -6 - r() * 1.5;
      size[i] = 1.2 + r() * r() * 3.6;
      phase[i] = r();
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aSize", new BufferAttribute(size, 1));
    g.setAttribute("aPhase", new BufferAttribute(phase, 1));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 3 }, uPixelRatio: { value: pixelRatio }, uColor: { value: palette["--ic-whitewash"] } },
        vertexShader: starVertex,
        fragmentShader: starFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [palette, pixelRatio],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((_, delta) => {
    if (animate) material.uniforms.uTime.value += delta;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
