import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let speed = 5.0;
let rotSpeed = 0.08;
let ringCount = 6;
let shape = 1.0;       // 1.0 = square; <1 = wider rect; >1 = taller rect
let offset = 0.0;      // horizontal center offset; inner rings amplify it → staircase
let saturation = 1.0;
let hueShift = 0.0;
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
  uniform float uOffset;
  uniform float uSaturation;
  uniform float uHueShift;
  uniform float uColorPhase;

  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - 0.5) * vec2(aspect, 1.0);

    // Start at 45° (diamond look), spin over time.
    float angle = 0.7854 + uTime * uRotSpeed;
    float cosA  = cos(angle);
    float sinA  = sin(angle);
    vec2 ruv = vec2(cosA * uv.x - sinA * uv.y,
                    sinA * uv.x + cosA * uv.y);

    // ── Offset ──────────────────────────────────────────────────────────────
    // Shift the Chebyshev centre by uOffset. Because inner rings are small in
    // screen space, a fixed UV offset displaces them much more visually than
    // outer rings → natural staircase / off-axis perspective look.
    vec2 cUV = ruv - vec2(uOffset, 0.0);

    // ── Distance & depth ────────────────────────────────────────────────────
    // Chebyshev (L∞) → rectangular shape. Divide x by aspect → visual square.
    float d     = max(abs(cUV.x) * uShape / aspect, abs(cUV.y));
    float depth = 1.0 / max(d, 0.001);

    float stripeRaw = depth * uRingCount * 0.04 - uTime * uSpeed * 0.05;
    float stripe    = fract(stripeRaw);

    // Cosine blend 0→1→0 per band.
    float t   = 0.5 - 0.5 * cos(stripe * 6.28318);
    float hA  = mod(0.04 + uHueShift + sin(uColorPhase * 0.7) * 0.02, 1.0);
    float hB  = mod(0.88 + uHueShift + cos(uColorPhase * 0.5) * 0.03, 1.0);
    vec3 colA = hsl2rgb(hA, 0.85, 0.65);
    vec3 colB = hsl2rgb(hB, 1.00, 0.50);
    vec3 col  = mix(colA, colB, t);

    // ── 3-D face shading ─────────────────────────────────────────────────────
    // Determine which of the four rectangle faces this pixel lies on and apply
    // a lighting model: right = bright (lit), left = dark (shadow),
    // top = medium-bright, bottom = medium-dark.
    float faceX  = cUV.x * uShape / aspect; // positive → right face
    float faceY  = cUV.y;                   // positive → top face
    float absX   = abs(faceX);
    float absY   = abs(faceY);
    // inX: 1 = on a left/right face, 0 = on a top/bottom face (smooth blend at corners)
    float inX    = smoothstep(-0.04, 0.04, absX - absY);
    float xLight = faceX > 0.0 ? 1.40 : 0.50; // right = lit, left = shadow
    float yLight = faceY > 0.0 ? 0.95 : 0.75; // top = slight highlight, bottom = shade
    float shade  = mix(yLight, xLight, inX);
    col = clamp(col * shade, 0.0, 1.0);

    // ── Saturation ───────────────────────────────────────────────────────────
    // 0 = pure white (with face-shading still visible as gray tones), 1 = full colour.
    col = mix(vec3(1.0), col, uSaturation);

    // ── Density fade near centre ─────────────────────────────────────────────
    // Isotropic pre-fract derivative → no cross artifact.
    float rawFw    = length(vec2(dFdx(stripeRaw), dFdy(stripeRaw)));
    float fade     = 1.0 - smoothstep(0.8, 1.8, rawFw);
    vec3 darkColor = mix(vec3(0.0), hsl2rgb(0.87, 0.60, 0.04), uSaturation);
    col = mix(darkColor, col, fade);

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
    { label: "Offset",      type: "range", min: -0.5, max: 0.5, step: 0.01, get: () => offset,     set: (v) => { offset = v; } },
    { label: "Saturation",  type: "range", min: 0.0,  max: 1.0, step: 0.05, get: () => saturation, set: (v) => { saturation = v; } },
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
        uOffset:     { value: offset },
        uSaturation: { value: saturation },
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
    material.uniforms.uOffset.value     = offset;
    material.uniforms.uSaturation.value = saturation;
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
