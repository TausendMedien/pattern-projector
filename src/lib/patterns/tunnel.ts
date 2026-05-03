import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let speed = 0.5;
let twist = 0.175;
let ringCount = 120;
let lineThickness = 0.5;
let saturation = 0.90;
let colorSpeed = 0.60;

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
  uniform float uTwist;
  uniform float uRingCount;
  uniform float uLineWidth;
  uniform float uSaturation;
  uniform float uColorPhase;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    float r = length(uv);
    if (r < 0.001) discard;

    // Perspective-like depth: 1/r so near rings are large, far rings are small.
    float depth = 1.0 / r;

    // Twist increases with depth, matching the original per-ring i*twist rotation.
    // Dynamic spin matches the original ring.rotation.z += dt * 0.3.
    float angle = atan(uv.y, uv.x) + uTwist * depth * 10.0 + uTime * 0.3;
    // angle is used only for future per-ring color variation; suppress unused warning.
    angle = angle;

    // Animated rings scrolling towards the viewer.
    float stripe = fract(depth * uRingCount * 0.004 - uTime * uSpeed * 0.05);

    // Screen-adaptive AA: fwidth gives the derivative in screen pixels,
    // so the soft edge always spans ~1 pixel regardless of resolution.
    float fw = fwidth(stripe);
    float lw = uLineWidth;
    float line = smoothstep(0.0, fw, stripe)
               - smoothstep(max(lw - fw, 0.0), lw, stripe);

    if (line < 0.01) discard;

    // Hue cycles 0.50 → 0.83 over time, same formula as the original.
    float hue = 0.5 + fract(uColorPhase) * 0.33;
    float lit = 0.55 + 0.15 * sin(uTime * 0.4 + depth * 0.2);
    vec3 col = hsl2rgb(hue, uSaturation * 0.85, 0.6);

    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray), col, uSaturation);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + stripe * 12.0);
    col *= pulse * line;

    gl_FragColor = vec4(col, line);
  }
`;

export const tunnel: Pattern = {
  id: "tunnel",
  name: "Tunnel",
  controls: [
    { label: "Speed",       type: "range", min: 0.5,  max: 15,  step: 0.5,   get: () => speed,         set: (v) => { speed = v; } },
    { label: "Twist",       type: "range", min: 0,    max: 0.3, step: 0.005, get: () => twist,         set: (v) => { twist = v; } },
    { label: "Ring Count",  type: "range", min: 10,   max: 120, step: 2,     get: () => ringCount,     set: (v) => { ringCount = v; } },
    { label: "Thickness",   type: "range", min: 0.02, max: 0.5, step: 0.02,  get: () => lineThickness, set: (v) => { lineThickness = v; } },
    { label: "Saturation",  type: "range", min: 0.0,  max: 1.0, step: 0.05,  get: () => saturation,    set: (v) => { saturation = v; } },
    { label: "Color Speed", type: "range", min: 0.0,  max: 1.0, step: 0.05,  get: () => colorSpeed,    set: (v) => { colorSpeed = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uSpeed:      { value: speed },
        uTwist:      { value: twist },
        uRingCount:  { value: ringCount },
        uLineWidth:  { value: lineThickness },
        uSaturation: { value: saturation },
        uColorPhase: { value: colorPhase },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
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
    material.uniforms.uTwist.value      = twist;
    material.uniforms.uRingCount.value  = ringCount;
    material.uniforms.uLineWidth.value  = lineThickness;
    material.uniforms.uSaturation.value = saturation;
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
