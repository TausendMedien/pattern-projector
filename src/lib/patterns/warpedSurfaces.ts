import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let warpIterations = 2;  // select index → 1, 2, 3, 4
let noiseScale    = 1.2;
let warpAmount    = 1.6;
let flowSpeed     = 0.04;
let palette       = 0;   // select: Iridescent / Fire / Ocean / Void
let saturation    = 0.9;
let brightness    = 1.1;

let accTime = 0;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uNoiseScale;
  uniform float uWarpAmount;
  uniform int   uIterations;
  uniform int   uPalette;
  uniform float uSaturation;
  uniform float uBrightness;

  #define PI  3.14159265358979
  #define TAU 6.28318530717959

  // Value noise
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { v += a*noise(p); p = p*2.1+vec2(3.7,1.3); a *= 0.5; }
    return v;
  }

  // Polar domain warp — rotates p by angle*amount radians around origin
  vec2 polarWarp(vec2 p, float angle, float amount) {
    float r     = length(p);
    float theta = atan(p.y, p.x) + angle * amount;
    return vec2(cos(theta), sin(theta)) * r;
  }

  vec2 warpedPos(vec2 p, float t) {
    for (int i = 0; i < 4; i++) {
      if (i >= uIterations) break;
      float a = fbm(p * 0.8 + t * 0.07 + float(i) * 3.1) * TAU;
      float m = fbm(p * 0.6 - t * 0.05 + float(i) * 1.7) * uWarpAmount;
      p = polarWarp(p, a, m);
    }
    return p;
  }

  // Cosine palette helper
  vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
  }

  vec3 applyPalette(float v) {
    if (uPalette == 0) // Iridescent
      return cosPalette(v, vec3(0.5,0.5,0.5), vec3(0.5,0.5,0.5), vec3(1.0,1.0,1.0), vec3(0.00,0.33,0.67));
    if (uPalette == 1) // Fire
      return cosPalette(v, vec3(0.5,0.2,0.1), vec3(0.5,0.4,0.1), vec3(1.0,1.0,1.0), vec3(0.0,0.15,0.25));
    if (uPalette == 2) // Ocean
      return cosPalette(v, vec3(0.1,0.4,0.5), vec3(0.2,0.3,0.3), vec3(1.0,1.0,1.0), vec3(0.1,0.4,0.7));
    // Void (3)
    return cosPalette(v, vec3(0.3,0.1,0.4), vec3(0.3,0.1,0.4), vec3(1.0,1.0,1.0), vec3(0.55,0.65,0.75));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * uNoiseScale;

    vec2 wp = warpedPos(p, uTime);
    float v = fbm(wp * 1.4 + uTime * 0.03);

    vec3 col = applyPalette(v);

    // Saturation
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray), col, uSaturation);

    col *= uBrightness;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export const warpedSurfaces: Pattern = {
  id: "warpedSurfaces",
  name: "Warped Surfaces",
  attribution: "Inspired by Anton Palsson (palmdrop) — surfaces",
  controls: [
    { label: "Warp Iterations", type: "select", options: ["1", "2", "3", "4"],
      get: () => warpIterations - 1, set: (v) => { warpIterations = v + 1; } },
    { label: "Noise Scale",  type: "range", min: 0.3, max: 3.0, step: 0.05, default: 1.2, get: () => noiseScale,  set: (v) => { noiseScale = v; } },
    { label: "Warp Amount",  type: "range", min: 0.0, max: 4.0, step: 0.1,  default: 1.6, get: () => warpAmount,  set: (v) => { warpAmount = v; } },
    { label: "Flow Speed",   type: "range", min: 0.0, max: 0.2, step: 0.005, default: 0.04, get: () => flowSpeed, set: (v) => { flowSpeed = v; } },
    { label: "Color Palette", type: "select", options: ["Iridescent", "Fire", "Ocean", "Void"],
      get: () => palette, set: (v) => { palette = v; } },
    { label: "Saturation",   type: "range", min: 0.0, max: 1.0, step: 0.05, default: 0.9,  get: () => saturation, set: (v) => { saturation = v; } },
    { label: "Brightness",   type: "range", min: 0.2, max: 2.0, step: 0.05, default: 1.1,  get: () => brightness, set: (v) => { brightness = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uNoiseScale: { value: noiseScale },
        uWarpAmount: { value: warpAmount },
        uIterations: { value: warpIterations },
        uPalette:    { value: palette },
        uSaturation: { value: saturation },
        uBrightness: { value: brightness },
      },
      vertexShader, fragmentShader, depthTest: false, depthWrite: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    ctx.scene.add(mesh);
  },

  update(dt: number, _elapsed: number) {
    if (!material) return;
    accTime += dt * flowSpeed;
    material.uniforms.uTime.value       = accTime;
    material.uniforms.uNoiseScale.value = noiseScale;
    material.uniforms.uWarpAmount.value = warpAmount;
    material.uniforms.uIterations.value = warpIterations;
    material.uniforms.uPalette.value    = palette;
    material.uniforms.uSaturation.value = saturation;
    material.uniforms.uBrightness.value = brightness;
  },

  resize(width: number, height: number) {
    if (material) material.uniforms.uResolution.value.set(width, height);
  },

  dispose() {
    geometry?.dispose(); material?.dispose();
    mesh = null; geometry = null; material = null;
    accTime = 0;
  },
};
