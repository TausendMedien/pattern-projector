import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let speed = 5.0;
let rotSpeed = 0.08;   // rotation speed; negative = reverse spin
let ringCount = 6;
let shape = 1.0;       // 1.0 = square; <1 = wider rect; >1 = taller rect
let hueShift = 0.0;    // 0…1 shifts both colours around the hue wheel
let colorSpeed = 0.30;

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
  uniform float uShape;
  uniform float uHueShift;
  uniform float uColorPhase;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // Aspect-corrected UV for visually correct rotation.
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    // Start at 45° so the shape opens as a diamond; rotate over time.
    float angle = 0.7854 + uTime * uRotSpeed;
    float cosA  = cos(angle);
    float sinA  = sin(angle);
    vec2 ruv = vec2(cosA * uv.x - sinA * uv.y,
                    sinA * uv.x + cosA * uv.y);

    // Chebyshev (L∞) metric → rectangular/square shapes.
    // Dividing x by aspect undoes the aspect stretch → visual square at shape=1.
    // uShape scales the x contribution: <1 wider, >1 taller.
    float d = max(abs(ruv.x) * uShape / aspect, abs(ruv.y));

    float depth = 1.0 / max(d, 0.001);

    // Ring animation — same scroll formula as circular tunnel.
    float stripeRaw = depth * uRingCount * 0.04 - uTime * uSpeed * 0.05;
    float stripe    = fract(stripeRaw);

    // Smooth cosine blend within each band: 0 → 1 → 0 per period.
    float t = 0.5 - 0.5 * cos(stripe * 6.28318);

    // Two hues oscillate gently over time for the living-colour effect.
    float hA = mod(0.04 + uHueShift + sin(uColorPhase * 0.7) * 0.02, 1.0); // warm coral
    float hB = mod(0.88 + uHueShift + cos(uColorPhase * 0.5) * 0.03, 1.0); // hot magenta

    vec3 colA = hsl2rgb(hA, 0.85, 0.65); // salmon / coral
    vec3 colB = hsl2rgb(hB, 1.00, 0.50); // hot pink / magenta
    vec3 col  = mix(colA, colB, t);

    // Density fade near centre: isotropic pre-fract derivative (no cross artifact).
    float rawFw = length(vec2(dFdx(stripeRaw), dFdy(stripeRaw)));
    float fade  = 1.0 - smoothstep(0.8, 1.8, rawFw);

    // Blend toward a deep dark colour rather than hard black at the centre.
    vec3 dark = hsl2rgb(0.87, 0.60, 0.04);
    col = mix(dark, col, fade);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const tunnelRect: Pattern = {
  id: "tunnelRect",
  name: "Tunnel — Rect",
  controls: [
    { label: "Speed",       type: "range", min: -50,  max: 50,  step: 1,    get: () => speed,      set: (v) => { speed = v; } },
    { label: "Rotation",    type: "range", min: -0.3, max: 0.3, step: 0.01, get: () => rotSpeed,   set: (v) => { rotSpeed = v; } },
    { label: "Ring Count",  type: "range", min: 1,    max: 20,  step: 1,    get: () => ringCount,  set: (v) => { ringCount = v; } },
    { label: "Shape",       type: "range", min: 0.3,  max: 3.0, step: 0.1,  get: () => shape,      set: (v) => { shape = v; } },
    { label: "Hue Shift",   type: "range", min: 0.0,  max: 1.0, step: 0.05, get: () => hueShift,   set: (v) => { hueShift = v; } },
    { label: "Color Speed", type: "range", min: 0.0,  max: 1.0, step: 0.05, get: () => colorSpeed, set: (v) => { colorSpeed = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uSpeed:      { value: speed },
        uRotSpeed:   { value: rotSpeed },
        uRingCount:  { value: ringCount },
        uShape:      { value: shape },
        uHueShift:   { value: hueShift },
        uColorPhase: { value: colorPhase },
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
    colorPhase += dt * colorSpeed * 0.3;
    material.uniforms.uTime.value       = elapsed;
    material.uniforms.uSpeed.value      = speed;
    material.uniforms.uRotSpeed.value   = rotSpeed;
    material.uniforms.uRingCount.value  = ringCount;
    material.uniforms.uShape.value      = shape;
    material.uniforms.uHueShift.value   = hueShift;
    material.uniforms.uColorPhase.value = colorPhase;
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
