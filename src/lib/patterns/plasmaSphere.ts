import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.SphereGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let lavaSpeed    = 0.08;
let crackScale   = 3.0;
let glowIntensity = 1.2;
let heatColor    = 0;   // select: Lava / Acid / Plasma
let rotationSpeed = 0.3;

let accTime = 0;
let rotY = 0;

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal   = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uCrackScale;
  uniform float uGlow;
  uniform int   uHeatColor;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
    return mix(
      mix(mix(hash(i),           hash(i+vec3(1,0,0)), u.x),
          mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), u.x), u.y),
      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), u.x),
          mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), u.x), u.y),
      u.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a*noise(p); p = p*2.1+vec3(1.7,3.1,0.5); a *= 0.5; }
    return v;
  }

  // Voronoi distance for crack pattern
  float voronoi(vec3 p) {
    vec3 b = floor(p);
    float md = 8.0;
    for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec3 nb = b + vec3(x, y, z);
      vec3 pt = nb + hash(nb) - p;
      md = min(md, dot(pt, pt));
    }
    return sqrt(md);
  }

  vec3 heatPalette(float v) {
    if (uHeatColor == 0) // Lava: black → deep red → orange → bright yellow
      return mix(mix(vec3(0.02,0.0,0.0), vec3(0.8,0.1,0.0), smoothstep(0.0,0.5,v)),
                 mix(vec3(0.8,0.1,0.0), vec3(1.0,0.9,0.1), smoothstep(0.5,1.0,v)), step(0.5,v));
    if (uHeatColor == 1) // Acid: black → dark green → toxic yellow-green
      return mix(mix(vec3(0.0,0.02,0.0), vec3(0.05,0.5,0.0), smoothstep(0.0,0.5,v)),
                 mix(vec3(0.05,0.5,0.0), vec3(0.7,1.0,0.0), smoothstep(0.5,1.0,v)), step(0.5,v));
    // Plasma: dark purple → magenta → cyan-white
    return mix(mix(vec3(0.02,0.0,0.05), vec3(0.6,0.0,0.8), smoothstep(0.0,0.5,v)),
               mix(vec3(0.6,0.0,0.8), vec3(0.5,1.0,1.0),  smoothstep(0.5,1.0,v)), step(0.5,v));
  }

  void main() {
    vec3 p = normalize(vPosition) * uCrackScale;

    // Crack edges from Voronoi
    float vor  = voronoi(p + uTime * 0.15);
    float crack = 1.0 - smoothstep(0.0, 0.18, vor);

    // Lava glow in the cracks via FBM
    float flow = fbm(p * 0.8 + uTime * 0.2);
    float heat = crack * (0.5 + flow * 0.8);

    // Base dark rock surface
    float rock = fbm(p * 1.5 - uTime * 0.05);
    float base = rock * 0.25;

    float v = clamp(base + heat * uGlow, 0.0, 1.0);
    vec3 col = heatPalette(v);

    // Simple diffuse from a slightly elevated light
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.6));
    float diff = max(0.0, dot(vNormal, lightDir));
    col = col * (0.4 + 0.6 * diff);

    // Emissive glow from hot cracks — ignore lighting there
    col = mix(col, heatPalette(clamp(heat * uGlow, 0.0, 1.0)) * uGlow, crack * 0.7);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export const plasmaSphere: Pattern = {
  id: "plasmaSphere",
  name: "Plasma Sphere",
  attribution: "Inspired by Mauricio Massaia — proto-06",
  controls: [
    { label: "Lava Speed",    type: "range", min: 0.0, max: 0.4,  step: 0.01,  default: 0.08, get: () => lavaSpeed,    set: (v) => { lavaSpeed = v; } },
    { label: "Crack Scale",   type: "range", min: 0.5, max: 8.0,  step: 0.1,   default: 3.0,  get: () => crackScale,   set: (v) => { crackScale = v; } },
    { label: "Glow",          type: "range", min: 0.2, max: 3.0,  step: 0.05,  default: 1.2,  get: () => glowIntensity, set: (v) => { glowIntensity = v; } },
    { label: "Heat Color",    type: "select", options: ["Lava", "Acid", "Plasma"],
      get: () => heatColor, set: (v) => { heatColor = v; } },
    { label: "Rotation",      type: "range", min: 0.0, max: 2.0,  step: 0.05,  default: 0.3,  get: () => rotationSpeed, set: (v) => { rotationSpeed = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.SphereGeometry(1, 64, 64);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uCrackScale: { value: crackScale },
        uGlow:       { value: glowIntensity },
        uHeatColor:  { value: heatColor },
      },
      vertexShader, fragmentShader,
    });
    mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);
    ctx.camera.position.set(0, 0, 2.5);
    ctx.camera.near = 0.1;
    ctx.camera.far  = 100;
    ctx.camera.updateProjectionMatrix();
  },

  update(dt: number, _elapsed: number) {
    if (!material || !mesh) return;
    accTime += dt * lavaSpeed;
    rotY    += dt * rotationSpeed * 0.3;
    material.uniforms.uTime.value       = accTime;
    material.uniforms.uCrackScale.value = crackScale;
    material.uniforms.uGlow.value       = glowIntensity;
    material.uniforms.uHeatColor.value  = heatColor;
    mesh.rotation.y = rotY;
  },

  resize(_width: number, _height: number) {},

  dispose() {
    geometry?.dispose(); material?.dispose();
    mesh = null; geometry = null; material = null;
    accTime = 0; rotY = 0;
  },
};
