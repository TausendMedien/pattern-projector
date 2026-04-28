import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let lineCount = 54;
let scrollSpeed = 0.22;
let lineWidth = 0.10;
let colorRange = 0.5;
let saturation = 0.85;

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
  uniform float uColorRange;
  uniform float uSaturation;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    float scroll = uTime * uScrollSpeed;
    float stripe = fract(uv.x * uLineCount * 0.5 + scroll);

    float edge = 0.025;
    float line = smoothstep(0.0, edge, stripe) - smoothstep(uLineWidth - edge, uLineWidth, stripe);

    if (line < 0.01) discard;

    // Cyberpunk hue: cyan (0.50) → blue (0.67) → magenta (0.83)
    float rawHue = fract(uv.x * 0.25 * uColorRange + uTime * 0.06);
    float hue = 0.5 + rawHue * 0.33;
    float lit = 0.55 + 0.15 * sin(uTime * 0.4 + uv.y * 2.0);
    vec3 col = hsl2rgb(hue, 1.0, lit);

    // Saturation (0 = B&W, 1 = full color)
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray), col, uSaturation);

    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + stripe * 12.0);
    col *= pulse * line;

    gl_FragColor = vec4(col, line);
  }
`;

export const parallelLinesStraight: Pattern = {
  id: "parallelLinesStraight",
  name: "Parallel Lines — Straight",
  controls: [
    { label: "Line Count",   type: "range", min: 10,  max: 120, step: 1,    get: () => lineCount,   set: (v) => { lineCount = v; } },
    { label: "Scroll Speed", type: "range", min: 0.02,max: 1.0, step: 0.01, get: () => scrollSpeed, set: (v) => { scrollSpeed = v; } },
    { label: "Line Width",   type: "range", min: 0.02,max: 0.4, step: 0.01, get: () => lineWidth,   set: (v) => { lineWidth = v; } },
    { label: "Colors",       type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => colorRange,  set: (v) => { colorRange = v; } },
    { label: "Saturation",   type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => saturation,  set: (v) => { saturation = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uResolution:  { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uLineCount:   { value: lineCount },
        uScrollSpeed: { value: scrollSpeed },
        uLineWidth:   { value: lineWidth },
        uColorRange:  { value: colorRange },
        uSaturation:  { value: saturation },
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
    material.uniforms.uColorRange.value = colorRange;
    material.uniforms.uSaturation.value = saturation;
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
