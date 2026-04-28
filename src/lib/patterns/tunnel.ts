import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

const RING_COUNT = 60;
const RING_SPACING = 1.5;

let speed = 12;
let twist = 0.07;

let group: THREE.Group | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let geometry: THREE.RingGeometry | null = null;
let material: THREE.LineBasicMaterial | null = null;
const rings: THREE.LineSegments[] = [];

export const tunnel: Pattern = {
  id: "tunnel",
  name: "Tunnel",
  controls: [
    { label: "Speed", type: "range", min: 1, max: 40, step: 0.5, get: () => speed, set: (v) => { speed = v; } },
    { label: "Twist", type: "range", min: 0, max: 0.3, step: 0.005, get: () => twist, set: (v) => { twist = v; } },
  ],

  init(ctx: PatternContext) {
    camera = ctx.camera;
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    group = new THREE.Group();
    ctx.scene.add(group);

    geometry = new THREE.RingGeometry(2.4, 2.5, 48, 1);
    const edges = new THREE.EdgesGeometry(geometry);
    material = new THREE.LineBasicMaterial({ color: 0x66ddff });

    for (let i = 0; i < RING_COUNT; i++) {
      const ring = new THREE.LineSegments(edges, material);
      ring.position.z = -i * RING_SPACING;
      ring.rotation.z = i * twist;
      group.add(ring);
      rings.push(ring);
    }
  },

  update(dt: number, elapsed: number) {
    if (!group || !camera) return;
    const limitFront = 1;
    const limitBack = -RING_COUNT * RING_SPACING;
    for (const ring of rings) {
      ring.position.z += speed * dt;
      if (ring.position.z > limitFront) {
        ring.position.z += limitBack;
      }
      ring.rotation.z += dt * 0.3;
    }
    if (material) {
      const hue = (elapsed * 0.05) % 1;
      material.color.setHSL(hue, 0.7, 0.6);
    }
  },

  resize() {},

  dispose() {
    for (const r of rings) r.geometry.dispose();
    rings.length = 0;
    geometry?.dispose();
    material?.dispose();
    group = null;
    geometry = null;
    material = null;
    camera = null;
  },
};
