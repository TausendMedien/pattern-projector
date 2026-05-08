import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let speed = 4.0;
let rotSpeed = 0.06;
let ringCount = 8;
let ringOffset = 0.0;
let shadowWidth = 0.35;
let saturation = 1.0;
let colorDrift = 0.2;

let colorPhase = 0;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uSpeed;
  uniform float uRotSpeed;
  uniform float uRingCount;
  uniform float uRingOffset;
  uniform float uShadowWidth;
  uniform float uSaturation;
  uniform float uColorPhase;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  vec2 rot2d(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    // Global rotation: 45° base (diamond) + continuous time rotation
    float globalAngle = 0.7854 + uTime * uRotSpeed;
    vec2 ruv = rot2d(uv, globalAngle);

    // Pass 1: approximate ring index from unrotated distance (avoids seam artifacts)
    float d0 = max(abs(ruv.x), abs(ruv.y));
    float approxStripe = (1.0 / max(d0, 0.001)) * uRingCount * 0.04 - uTime * uSpeed * 0.05;
    float ringIdx = floor(approxStripe);

    // Per-ring cumulative rotation
    vec2 rruv = rot2d(ruv, ringIdx * uRingOffset);

    // Pass 2: final Chebyshev distance with per-ring-rotated UV
    float d = max(abs(rruv.x), abs(rruv.y));
    float depth = 1.0 / max(d, 0.001);
    float stripeRaw = depth * uRingCount * 0.04 - uTime * uSpeed * 0.05;
    float stripe = fract(stripeRaw); // 0 = inner edge, 1 = outer edge

    // Global color gradient based on d (distance from center)
    // d=0 center, d~0.5 outer. Map to [0,1] for palette.
    float colorT = clamp(d * 2.2, 0.0, 1.0);

    // Palette: dark purple → hot magenta → salmon/coral
    // Animated slowly via colorPhase
    float phase = uColorPhase;
    vec3 colorCenter = hsl2rgb(mod(0.820 + phase * 0.03, 1.0), 0.50, 0.12); // dark purple
    vec3 colorMid    = hsl2rgb(mod(0.900 + phase * 0.02, 1.0), 1.00, 0.55); // hot magenta
    vec3 colorOuter  = hsl2rgb(mod(0.030 + phase * 0.01, 1.0), 0.90, 0.68); // salmon/coral

    vec3 col;
    if (colorT < 0.5) {
      col = mix(colorCenter, colorMid, colorT * 2.0);
    } else {
      col = mix(colorMid, colorOuter, (colorT - 0.5) * 2.0);
    }

    // Soft shadow bevel at inner edge of each ring
    float shadow = smoothstep(0.0, uShadowWidth, stripe);
    col *= mix(0.08, 1.0, shadow);

    // Subtle brightness lift toward outer edge (adds depth sense)
    col *= (0.75 + 0.35 * stripe);
    col = clamp(col, 0.0, 1.0);

    // Saturation
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, uSaturation);

    // Density fade at center (fwidth-based)
    float rawFw = length(vec2(dFdx(stripeRaw), dFdy(stripeRaw)));
    float fade = 1.0 - smoothstep(0.8, 1.8, rawFw);
    col = mix(colorCenter * uSaturation + vec3(lum) * (1.0 - uSaturation), col, fade);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const softSedgewick: Pattern = {
  id: "softSedgewick",
  name: "Soft Sedgewick",
  controls: [
    { label: "Speed",        type: "range", min: -20,  max: 20,   step: 0.5,  default: 4,    get: () => speed,        set: (v) => { speed = v; } },
    { label: "Rotation",     type: "range", min: -0.3, max: 0.3,  step: 0.01, default: 0.06, get: () => rotSpeed,     set: (v) => { rotSpeed = v; } },
    { label: "Ring Count",   type: "range", min: 2,    max: 20,   step: 1,    default: 8,    get: () => ringCount,    set: (v) => { ringCount = v; } },
    { label: "Ring Offset",  type: "range", min: -0.3, max: 0.3,  step: 0.01, default: 0,    get: () => ringOffset,   set: (v) => { ringOffset = v; } },
    { label: "Shadow Width", type: "range", min: 0.05, max: 0.8,  step: 0.01, default: 0.35, get: () => shadowWidth,  set: (v) => { shadowWidth = v; } },
    { label: "Saturation",   type: "range", min: 0.0,  max: 1.0,  step: 0.05, default: 1,    get: () => saturation,   set: (v) => { saturation = v; } },
    { label: "Color Drift",  type: "range", min: 0.0,  max: 1.0,  step: 0.05, default: 0.2,  get: () => colorDrift,   set: (v) => { colorDrift = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uResolution:  { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uSpeed:       { value: speed },
        uRotSpeed:    { value: rotSpeed },
        uRingCount:   { value: ringCount },
        uRingOffset:  { value: ringOffset },
        uShadowWidth: { value: shadowWidth },
        uSaturation:  { value: saturation },
        uColorPhase:  { value: colorPhase },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    ctx.scene.add(mesh);
  },

  update(dt: number, elapsed: number) {
    if (!material) return;
    colorPhase += dt * colorDrift * 0.1;
    material.uniforms.uTime.value        = elapsed;
    material.uniforms.uSpeed.value       = speed;
    material.uniforms.uRotSpeed.value    = rotSpeed;
    material.uniforms.uRingCount.value   = ringCount;
    material.uniforms.uRingOffset.value  = ringOffset;
    material.uniforms.uShadowWidth.value = shadowWidth;
    material.uniforms.uSaturation.value  = saturation;
    material.uniforms.uColorPhase.value  = colorPhase;
  },

  resize(width: number, height: number) {
    if (material) material.uniforms.uResolution.value.set(width, height);
  },

  dispose() {
    geometry?.dispose();
    material?.dispose();
    mesh = null;
    geometry = null;
    material = null;
  },
};
