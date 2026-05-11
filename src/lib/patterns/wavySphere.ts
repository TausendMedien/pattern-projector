import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.SphereGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let waveSpeed    = 0.04;
let amplitude    = 0.22;
let rotationSpeed = 0.4;
let colorShift   = 0.0;

let accTime  = 0;
let rotX = 0, rotY = 0, rotZ = 0;

const vertexShader = /* glsl */ `
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uAmplitude;

  void main() {
    float angInc = 3.14159 / 1024.0;
    float angle = (position.x + position.z) * angInc;

    vec3 pos = position;
    pos.x *= cos(angle * uTime) * uAmplitude + 1.0;
    pos.z *= cos(angle * uTime) * uAmplitude + 1.0;
    pos.y *= sin(angle * uTime) * uAmplitude + 1.0;

    vPosition = pos / 1024.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uColorShift;

  void main() {
    float x = clamp(vPosition.x + 0.5, 0.0, 1.0);
    float y = clamp(vPosition.y + 0.5, 0.0, 1.0);
    float z = clamp(vPosition.z + 0.1, 0.1, 1.0);
    float t = fract(uTime * 0.04 + uColorShift);
    gl_FragColor = vec4(t * 0.4 + 0.3, x * 0.8 + 0.1, y * 0.7 + 0.2, z);
  }
`;

export const wavySphere: Pattern = {
  id: "wavySphere",
  name: "Wavy Sphere",
  attribution: "Adapted from Mauricio Massaia — proto-02",
  controls: [
    { label: "Wave Speed",  type: "range", min: 0.0,  max: 0.15, step: 0.005, default: 0.04,  get: () => waveSpeed,     set: (v) => { waveSpeed = v; } },
    { label: "Amplitude",   type: "range", min: 0.0,  max: 0.6,  step: 0.01,  default: 0.22,  get: () => amplitude,     set: (v) => { amplitude = v; } },
    { label: "Rotation",    type: "range", min: 0.0,  max: 2.0,  step: 0.05,  default: 0.4,   get: () => rotationSpeed, set: (v) => { rotationSpeed = v; } },
    { label: "Color Shift", type: "range", min: 0.0,  max: 1.0,  step: 0.01,  default: 0.0,   get: () => colorShift,    set: (v) => { colorShift = v; } },
  ],

  init(ctx: PatternContext) {
    // Use a large radius (1024) matching the original proto-02 shader math
    geometry = new THREE.SphereGeometry(1024, 128, 128);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uAmplitude:  { value: amplitude },
        uColorShift: { value: colorShift },
      },
      vertexShader, fragmentShader,
      side: THREE.FrontSide,
    });
    mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);

    // Position camera far enough to see the large sphere
    ctx.camera.position.set(0, 0, 2800);
    ctx.camera.near = 1;
    ctx.camera.far  = 10000;
    ctx.camera.updateProjectionMatrix();
  },

  update(dt: number, _elapsed: number) {
    if (!material || !mesh) return;
    accTime  += dt * waveSpeed * 25;
    rotY     += dt * rotationSpeed * 0.005;
    rotX     += dt * rotationSpeed * 0.001;
    rotZ     += dt * rotationSpeed * 0.003;
    material.uniforms.uTime.value       = accTime;
    material.uniforms.uAmplitude.value  = amplitude;
    material.uniforms.uColorShift.value = colorShift;
    mesh.rotation.set(rotX, rotY, rotZ);
  },

  resize(width: number, height: number) {
    if (!material) return;
    // Re-adjust FOV/projection is handled by the renderer automatically
    void width; void height;
  },

  dispose() {
    geometry?.dispose(); material?.dispose();
    mesh = null; geometry = null; material = null;
    accTime = 0; rotX = 0; rotY = 0; rotZ = 0;
  },
};
