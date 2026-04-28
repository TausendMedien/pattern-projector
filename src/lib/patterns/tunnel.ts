import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

const RING_SPACING = 1.5;

let speed = 5;
let twist = 0.07;
let ringCount = 60;
let lineThickness = 0.1;
let saturation = 0.85;
let colorSpeed = 0.5;

let colorPhase = 0;

let group: THREE.Group | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let edgesGeo: THREE.EdgesGeometry | null = null;
let material: THREE.LineBasicMaterial | null = null;
const rings: THREE.LineSegments[] = [];

function buildRings() {
  if (!group) return;
  for (const r of rings) {
    r.geometry.dispose();
    group.remove(r);
  }
  rings.length = 0;
  edgesGeo?.dispose();

  const outerR = 2.5;
  const innerR = outerR - lineThickness;
  const ringGeo = new THREE.RingGeometry(innerR, outerR, 48, 1);
  edgesGeo = new THREE.EdgesGeometry(ringGeo);
  ringGeo.dispose();

  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.LineSegments(edgesGeo, material!);
    ring.position.z = -i * RING_SPACING;
    ring.rotation.z = i * twist;
    group.add(ring);
    rings.push(ring);
  }
}

export const tunnel: Pattern = {
  id: "tunnel",
  name: "Tunnel",
  controls: [
    { label: "Speed",        type: "range", min: 0.5, max: 15,  step: 0.5,  get: () => speed,         set: (v) => { speed = v; } },
    { label: "Twist",        type: "range", min: 0,   max: 0.3, step: 0.005,get: () => twist,         set: (v) => { twist = v; } },
    { label: "Ring Count",   type: "range", min: 10,  max: 120, step: 2,    get: () => ringCount,     set: (v) => { ringCount = v; buildRings(); } },
    { label: "Thickness",    type: "range", min: 0.02,max: 0.5, step: 0.02, get: () => lineThickness, set: (v) => { lineThickness = v; buildRings(); } },
    { label: "Saturation",   type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => saturation,    set: (v) => { saturation = v; } },
    { label: "Color Speed",  type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => colorSpeed,    set: (v) => { colorSpeed = v; } },
  ],

  init(ctx: PatternContext) {
    camera = ctx.camera;
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    group = new THREE.Group();
    ctx.scene.add(group);

    material = new THREE.LineBasicMaterial({ color: 0x00ccff });
    buildRings();
  },

  update(dt: number, _elapsed: number) {
    if (!group || !camera) return;
    const limitFront = 1;
    const limitBack = -ringCount * RING_SPACING;
    for (const ring of rings) {
      ring.position.z += speed * dt;
      if (ring.position.z > limitFront) {
        ring.position.z += limitBack;
      }
      ring.rotation.z += dt * 0.3;
    }
    if (material) {
      // colorSpeed=0 → phase stays fixed (no change); colorSpeed=1 → same rate as before
      colorPhase += dt * colorSpeed * 0.3;
      const hue = 0.5 + (colorPhase % 1.0) * 0.33;
      material.color.setHSL(hue, saturation * 0.85, 0.6);
    }
  },

  resize() {},

  dispose() {
    for (const r of rings) r.geometry.dispose();
    rings.length = 0;
    edgesGeo?.dispose();
    material?.dispose();
    group = null;
    edgesGeo = null;
    material = null;
    camera = null;
  },
};
