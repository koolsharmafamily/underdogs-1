"use client";
/*
  Full-view backgrounds, sized to cover the view at their depth.
  - Satin: black satin with a warm plum sheen and a slow ripple (static below Full).
  - AegeanSky: night navy deepening to Aegean blue at the horizon.
  - Firelight: copper flames breathing at the frame edges, pinned to the camera (Full only).
*/
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Mesh, PerspectiveCamera, PlaneGeometry, ShaderMaterial } from "three";
import type { Palette } from "../colors";
import { motion } from "../store";

/** Scales a unit plane at `depth` in front of the camera so it fills the view, with margin. */
function useCover(ref: React.RefObject<Mesh | null>, depth: number, margin = 1.15) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const h = 2 * depth * Math.tan((cam.fov * Math.PI) / 360) * margin;
    ref.current?.scale.set(h * (size.width / size.height), h, 1);
  }, [camera, size, depth, margin, ref]);
}

const satinVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    vPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
  }
`;

const satinFragment = /* glsl */ `
  uniform vec3 uDeep;
  varying vec3 vPos;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(uDeep, 1.0);
    #include <colorspace_fragment>
  }
`;

export function Satin({ palette, animate }: { palette: Palette; animate: boolean }) {
  void animate;
  const ref = useRef<Mesh>(null);
  const depth = 11;
  useCover(ref, depth);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 0 },
          uDeep: { value: palette["--ic-void"] },
        },
        vertexShader: satinVertex,
        fragmentShader: satinFragment,
        depthWrite: false,
      }),
    [palette],
  );
  const geometry = useMemo(() => new PlaneGeometry(1, 1, 8, 8), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh ref={ref} geometry={geometry} material={material} position={[0, 0, 6.2 - depth]} renderOrder={-10} />;
}

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  varying vec2 vUv;
  void main() {
    vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.75, vUv.y));
    col += uGlow * 0.18 * smoothstep(0.45, 0.0, vUv.y) * smoothstep(1.0, 0.2, abs(vUv.x - 0.5) * 2.0);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
const uvVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function AegeanSky({ palette }: { palette: Palette }) {
  const ref = useRef<Mesh>(null);
  const depth = 13;
  useCover(ref, depth);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTop: { value: palette["--ic-void"].clone().lerp(palette["--ic-night"], 0.7) },
          uHorizon: { value: palette["--ic-night"].clone().lerp(palette["--ic-aegean"], 0.35) },
          uGlow: { value: palette["--ic-sky"] },
        },
        vertexShader: uvVertex,
        fragmentShader: skyFragment,
        depthWrite: false,
      }),
    [palette],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh ref={ref} material={material} position={[0, 0, 6.2 - depth]} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

const fireFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHot;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    if (uIntensity <= 0.005) discard;
    // Flamy orange rising from the bottom and curling up the left/right edges against pure black.
    float sideEdge = max(smoothstep(0.32, 0.0, vUv.x), smoothstep(0.68, 1.0, vUv.x));
    float bottomRise = smoothstep(0.62, 0.0, vUv.y);
    float mask = clamp(sideEdge * 0.85 + bottomRise * 0.95, 0.0, 1.0);
    vec2 q = vec2(vUv.x * 4.6, vUv.y * 2.6 - uTime * 0.48);
    float f = fbm(q + fbm(q + uTime * 0.08));
    float flame = smoothstep(0.34, 0.92, f + (1.0 - vUv.y) * 0.34) * mask * uIntensity;
    vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.45, flame));
    col = mix(col, uHot, smoothstep(0.5, 0.98, flame));
    gl_FragColor = vec4(col * flame * 1.25, flame * 0.78);
    #include <colorspace_fragment>
  }
`;

/** Pinned to the camera as a child, one unit in front of it. Active in Intro (Chapter 0), fades to 0 on Main Home Page. */
export function Firelight({ palette }: { palette: Palette }) {
  const ref = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 1 },
          uDeep: { value: palette["--ic-ember-deep"] },
          uMid: { value: palette["--ic-ember"] },
          uHot: { value: palette["--ic-ember-hot"] },
        },
        vertexShader: uvVertex,
        fragmentShader: fireFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [palette],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const h = 2 * Math.tan((cam.fov * Math.PI) / 360);
    ref.current?.scale.set(h * (size.width / size.height), h, 1);
  }, [camera, size]);
  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
    // Bold flamy orange in the Intro (Chapter 0), fading smoothly to 0 so the main home page is pure black.
    const inIntro = !motion.entered[1];
    const targetIntensity = inIntro ? Math.max(0, 1 - motion.progress[0] * 1.15) : 0;
    const cur = material.uniforms.uIntensity.value as number;
    const next = cur + (targetIntensity - cur) * Math.min(1, delta * 8);
    material.uniforms.uIntensity.value = next;
    if (ref.current) {
      ref.current.visible = next > 0.005;
    }
  });
  return (
    <mesh ref={ref} material={material} position={[0, 0, -1]} renderOrder={20}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
