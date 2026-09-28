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
    float t = uTime * 0.12;
    // Long diagonal folds, like draped satin.
    float fold = sin(p.x * 5.0 + p.y * 2.2 + t * 2.0) * 0.5
               + sin(p.x * 2.1 - p.y * 4.3 - t * 1.3) * 0.35
               + sin(p.x * 9.0 + p.y * 1.3 + t * 3.1) * 0.12;
    p.z += fold * uAmp;
    vPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
  }
`;

const satinFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uFold;
  uniform vec3 uSheen;
  uniform vec3 uWarm;
  varying vec3 vPos;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
    vec3 key = normalize(vec3(-0.6, 0.7, 0.5));      // warm key from the top left, as in Logo.jpg
    float diff = clamp(dot(n, key), 0.0, 1.0);
    vec3 h = normalize(key + vec3(0.0, 0.0, 1.0));
    float sheen = pow(clamp(dot(n, h), 0.0, 1.0), 18.0);
    vec3 col = mix(uDeep, uFold, diff * 0.6);
    col += uSheen * sheen * 0.45;
    // Vignette toward the edges, a warm lift near the top left.
    float v = smoothstep(1.05, 0.25, distance(vUv, vec2(0.5)));
    col *= mix(0.2, 0.9, v);
    col += uWarm * 0.05 * smoothstep(0.9, 0.0, distance(vUv, vec2(0.2, 0.9)));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function Satin({ palette, animate }: { palette: Palette; animate: boolean }) {
  const ref = useRef<Mesh>(null);
  const depth = 11;
  useCover(ref, depth);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 7 },
          uAmp: { value: 0.035 },
          uDeep: { value: palette["--ic-void"] },
          uFold: { value: palette["--ic-satin-900"] },
          uSheen: { value: palette["--ic-satin-500"] },
          uWarm: { value: palette["--ic-ember"] },
        },
        vertexShader: satinVertex,
        fragmentShader: satinFragment,
        depthWrite: false,
      }),
    [palette],
  );
  const geometry = useMemo(() => new PlaneGeometry(1, 1, 96, 64), []);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (animate) material.uniforms.uTime.value += delta;
  });
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
    // Flames only near the left and right edges, rising.
    float edge = max(smoothstep(0.2, 0.0, vUv.x), smoothstep(0.8, 1.0, vUv.x));
    vec2 q = vec2(vUv.x * 5.0, vUv.y * 2.4 - uTime * 0.35);
    float f = fbm(q + fbm(q + uTime * 0.05));
    float flame = smoothstep(0.42, 0.95, f + (1.0 - vUv.y) * 0.25) * edge;
    vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.5, flame));
    col = mix(col, uHot, smoothstep(0.55, 1.0, flame));
    gl_FragColor = vec4(col * flame, flame * 0.55);
    #include <colorspace_fragment>
  }
`;

/** Pinned to the camera as a child, one unit in front of it. */
export function Firelight({ palette }: { palette: Palette }) {
  const ref = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
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
  });
  return (
    <mesh ref={ref} material={material} position={[0, 0, -1]} renderOrder={20}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
