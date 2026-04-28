import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

const NUM_LINES = 14;
const POINTS_PER_LINE = 64;

let rotationSpeed = 0.15;
let wobble = 0.25;
let colorRange = 0.7;
let saturation = 0.85;
let opacity = 1.0;

interface LineState {
  mesh: THREE.Mesh;
  geometry: THREE.TubeGeometry;
  material: THREE.MeshBasicMaterial;
  basePoints: THREE.Vector3[];
  phase: number;
}

const lines: LineState[] = [];
let group: THREE.Group | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function buildBasePoints(seed: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < POINTS_PER_LINE; i++) {
    const t = i / (POINTS_PER_LINE - 1);
    const a = t * Math.PI * 4 + seed;
    const r = 1.5 + Math.sin(seed * 1.7 + t * 6) * 0.6;
    pts.push(
      new THREE.Vector3(
        Math.cos(a) * r,
        (t - 0.5) * 5 + Math.sin(seed) * 0.5,
        Math.sin(a) * r,
      ),
    );
  }
  return pts;
}

export const lines3d: Pattern = {
  id: "lines3d",
  name: "3D Lines",
  controls: [
    { label: "Rotation Speed", type: "range", min: 0,   max: 0.5, step: 0.01, get: () => rotationSpeed, set: (v) => { rotationSpeed = v; } },
    { label: "Wobble",         type: "range", min: 0,   max: 0.8, step: 0.01, get: () => wobble,         set: (v) => { wobble = v; } },
    { label: "Colors",         type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => colorRange,     set: (v) => { colorRange = v; } },
    { label: "Saturation",     type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => saturation,     set: (v) => { saturation = v; } },
    { label: "Opacity",        type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => opacity,        set: (v) => { opacity = v; } },
  ],

  init(ctx: PatternContext) {
    camera = ctx.camera;
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);

    group = new THREE.Group();
    ctx.scene.add(group);

    for (let i = 0; i < NUM_LINES; i++) {
      const seed = i * 0.91;
      const basePoints = buildBasePoints(seed);
      const curve = new THREE.CatmullRomCurve3(basePoints, true, "centripetal");
      const geometry = new THREE.TubeGeometry(curve, 200, 0.03, 8, true);
      // Cyberpunk hue: spread from cyan (0.5) through blue to magenta (0.83)
      const hue = 0.5 + (i / NUM_LINES * colorRange) * 0.33;
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(hue, saturation, 0.55),
        transparent: true,
        opacity,
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      lines.push({ mesh, geometry, material, basePoints, phase: i * 0.4 });
    }
  },

  update(_dt: number, elapsed: number) {
    if (!group) return;
    group.rotation.y = elapsed * rotationSpeed;
    group.rotation.x = Math.sin(elapsed * 0.1) * 0.3;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Update color every frame so controls take effect immediately
      const hue = 0.5 + (i / NUM_LINES * colorRange) * 0.33;
      line.material.color.setHSL(hue, saturation, 0.55);
      line.material.opacity = opacity;

      const animated = line.basePoints.map((p, idx) => {
        const t = idx / (POINTS_PER_LINE - 1);
        const wob =
          Math.sin(elapsed * 0.8 + line.phase + t * 6) * wobble +
          Math.cos(elapsed * 0.5 + line.phase * 1.7 + t * 4) * wobble * 0.6;
        return new THREE.Vector3(p.x + wob, p.y, p.z + wob * 0.7);
      });
      const curve = new THREE.CatmullRomCurve3(animated, true, "centripetal");
      const next = new THREE.TubeGeometry(curve, 200, 0.03, 8, true);
      line.mesh.geometry.dispose();
      line.mesh.geometry = next;
      line.geometry = next;
    }
  },

  resize() {},

  dispose() {
    for (const line of lines) {
      line.mesh.geometry.dispose();
      line.material.dispose();
    }
    lines.length = 0;
    group = null;
    camera = null;
  },
};
