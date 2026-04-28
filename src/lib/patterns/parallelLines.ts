import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

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

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    // Number of lines and scroll speed
    float lineCount = 18.0;
    float scrollSpeed = 0.22;
    float waveAmp = 0.04;
    float waveFreq = 3.0;
    float lineWidth = 0.28; // fraction of the gap that is lit (0–1)

    // Scroll vertically over time
    float scroll = uTime * scrollSpeed;

    // Sine-wave distortion on x to make lines ripple
    float wave = sin(uv.y * waveFreq * 3.14159 + uTime * 1.4) * waveAmp
               + sin(uv.y * waveFreq * 1.7  + uTime * 0.9) * waveAmp * 0.5;

    float x = uv.x + wave;

    // Map x into repeating stripe space
    float stripe = fract((x * lineCount * 0.5) + scroll);

    // Soft line edge using smoothstep
    float edge = 0.04;
    float line = smoothstep(0.0, edge, stripe) - smoothstep(lineWidth - edge, lineWidth, stripe);

    if (line < 0.01) discard;

    // Colour: hue shifts across x and over time
    float hue = fract(uv.x * 0.25 + uTime * 0.06);
    float sat = 0.75;
    float lit = 0.55 + 0.15 * sin(uTime * 0.4 + uv.y * 2.0);
    vec3 col = hsl2rgb(hue, sat, lit);

    // Brightness pulse along each line
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + stripe * 12.0);
    col *= pulse * line;

    gl_FragColor = vec4(col, line);
  }
`;

export const parallelLines: Pattern = {
  id: "parallelLines",
  name: "Parallel Lines",

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
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
    if (material) material.uniforms.uTime.value = elapsed;
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
