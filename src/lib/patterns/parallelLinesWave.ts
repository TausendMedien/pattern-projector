import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let lineCount = 54;
let scrollSpeed = 0.22;
let lineWidth = 0.10;
let waveAmp = 0.04;

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
  uniform vec2 uResolution;
  uniform float uLineCount;
  uniform float uScrollSpeed;
  uniform float uLineWidth;
  uniform float uWaveAmp;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    float waveFreq = 3.0;
    float scroll = uTime * uScrollSpeed;

    float wave = sin(uv.y * waveFreq * 3.14159 + uTime * 1.4) * uWaveAmp
               + sin(uv.y * waveFreq * 1.7  + uTime * 0.9) * uWaveAmp * 0.5;

    float stripe = fract((uv.x + wave) * uLineCount * 0.5 + scroll);

    float edge = 0.025;
    float line = smoothstep(0.0, edge, stripe) - smoothstep(uLineWidth - edge, uLineWidth, stripe);

    if (line < 0.01) discard;

    float hue = fract(uv.x * 0.25 + uTime * 0.06);
    float lit = 0.55 + 0.15 * sin(uTime * 0.4 + uv.y * 2.0);
    vec3 col = hsl2rgb(hue, 0.75, lit);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + stripe * 12.0);
    col *= pulse * line;

    gl_FragColor = vec4(col, line);
  }
`;

export const parallelLinesWave: Pattern = {
  id: "parallelLinesWave",
  name: "Parallel Lines — Wave",
  controls: [
    { label: "Line Count", type: "range", min: 10, max: 120, step: 1, get: () => lineCount, set: (v) => { lineCount = v; } },
    { label: "Scroll Speed", type: "range", min: 0.02, max: 1.0, step: 0.01, get: () => scrollSpeed, set: (v) => { scrollSpeed = v; } },
    { label: "Line Width", type: "range", min: 0.02, max: 0.4, step: 0.01, get: () => lineWidth, set: (v) => { lineWidth = v; } },
    { label: "Wave Amplitude", type: "range", min: 0.0, max: 0.15, step: 0.005, get: () => waveAmp, set: (v) => { waveAmp = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uLineCount: { value: lineCount },
        uScrollSpeed: { value: scrollSpeed },
        uLineWidth: { value: lineWidth },
        uWaveAmp: { value: waveAmp },
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

  update(_dt: number, elapsed: number) {
    if (!material) return;
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uLineCount.value = lineCount;
    material.uniforms.uScrollSpeed.value = scrollSpeed;
    material.uniforms.uLineWidth.value = lineWidth;
    material.uniforms.uWaveAmp.value = waveAmp;
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
