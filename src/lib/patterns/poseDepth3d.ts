import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";
import { poseState } from "../pose";

const MAX_PERSONS = 5;
const PTS = 3; // leftWrist, rightWrist, hipCenter per person
const MAX_SPHERES = MAX_PERSONS * PTS;
// Skeleton edges within one person's points: [from, to]
const EDGES: [number, number][] = [[0, 2], [1, 2], [0, 1]];

let bodyTracking = true;
let depthScale = 2.5;
let sphereRadius = 0.18;
let showGrid = true;

let camera: THREE.PerspectiveCamera | null = null;
let aspect = 1;

const sphereMeshes: THREE.Mesh[] = [];
let sphereGeom: THREE.SphereGeometry | null = null;

const lineSets: THREE.LineSegments[] = [];
const lineGeos: THREE.BufferGeometry[] = [];

let gridHelper: THREE.GridHelper | null = null;
let ambientLight: THREE.AmbientLight | null = null;
let dirLight: THREE.DirectionalLight | null = null;

function poseToWorld(pt: { x: number; y: number; z: number }): THREE.Vector3 {
  const scaleY = 5.0;
  const scaleX = scaleY * aspect;
  return new THREE.Vector3(
    (pt.x - 0.5) * scaleX,
    (0.5 - pt.y) * scaleY,
    // Negate: MediaPipe negative z = closer to camera = positive world z (toward viewer)
    -pt.z * depthScale * 3,
  );
}

function depthColor(worldZ: number): THREE.Color {
  // worldZ positive = toward camera → warm; negative = away → cool
  const t = Math.max(0, Math.min(1, worldZ / (depthScale * 3) * 0.5 + 0.5));
  const c = new THREE.Color();
  c.setHSL(0.6 - t * 0.6, 1.0, 0.52 + t * 0.18);
  return c;
}

export const poseDepth3d: Pattern = {
  id: "poseDepth3d",
  name: "Pose Depth 3D",

  controls: [
    {
      label: "Body Tracking",
      type: "toggle",
      get: () => bodyTracking,
      set: (v) => { bodyTracking = v; },
    },
    {
      label: "Depth Scale",
      type: "range", min: 0.5, max: 5.0, step: 0.1,
      get: () => depthScale,
      set: (v) => { depthScale = v; },
    },
    {
      label: "Sphere Size",
      type: "range", min: 0.05, max: 0.5, step: 0.01,
      get: () => sphereRadius,
      set: (v) => { sphereRadius = v; },
    },
    {
      label: "Show Grid",
      type: "toggle",
      get: () => showGrid,
      set: (v) => { showGrid = v; if (gridHelper) gridHelper.visible = v; },
    },
  ],

  init(ctx: PatternContext) {
    camera = ctx.camera;
    aspect = ctx.size.width / Math.max(ctx.size.height, 1);

    // Angled camera so depth is perceptible as 3D layout
    camera.position.set(2, 2, 8);
    camera.lookAt(0, 0, 0);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    ctx.scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(4, 6, 5);
    ctx.scene.add(dirLight);

    gridHelper = new THREE.GridHelper(14, 14, 0x2a2a2a, 0x1a1a1a);
    gridHelper.position.y = -3.5;
    gridHelper.visible = showGrid;
    ctx.scene.add(gridHelper);

    sphereGeom = new THREE.SphereGeometry(1, 20, 14);
    for (let i = 0; i < MAX_SPHERES; i++) {
      const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x222222 });
      const mesh = new THREE.Mesh(sphereGeom, mat);
      mesh.visible = false;
      ctx.scene.add(mesh);
      sphereMeshes.push(mesh);
    }

    for (let i = 0; i < MAX_PERSONS; i++) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(EDGES.length * 2 * 3);
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.55,
      });
      const ls = new THREE.LineSegments(geo, mat);
      ls.visible = false;
      ctx.scene.add(ls);
      lineSets.push(ls);
      lineGeos.push(geo);
    }
  },

  update(_dt: number, _elapsed: number) {
    const persons = bodyTracking ? poseState.persons : [];
    let si = 0;

    for (let pi = 0; pi < MAX_PERSONS; pi++) {
      const person = persons[pi];

      if (person) {
        const positions = person.map(pt => poseToWorld(pt));

        for (let ji = 0; ji < PTS; ji++) {
          const mesh = sphereMeshes[si++];
          mesh.position.copy(positions[ji]);
          mesh.scale.setScalar(sphereRadius);
          (mesh.material as THREE.MeshPhongMaterial).color.copy(depthColor(positions[ji].z));
          mesh.visible = true;
        }

        const posAttr = lineGeos[pi].attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        EDGES.forEach(([a, b], ei) => {
          arr[ei * 6 + 0] = positions[a].x; arr[ei * 6 + 1] = positions[a].y; arr[ei * 6 + 2] = positions[a].z;
          arr[ei * 6 + 3] = positions[b].x; arr[ei * 6 + 4] = positions[b].y; arr[ei * 6 + 5] = positions[b].z;
        });
        posAttr.needsUpdate = true;
        lineSets[pi].visible = true;
      } else {
        for (let ji = 0; ji < PTS; ji++) { sphereMeshes[si++].visible = false; }
        if (lineSets[pi]) lineSets[pi].visible = false;
      }
    }
  },

  resize(width: number, height: number) {
    aspect = width / Math.max(height, 1);
    if (camera) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  },

  dispose() {
    sphereGeom?.dispose();
    sphereGeom = null;
    sphereMeshes.length = 0;
    lineGeos.forEach(g => g.dispose());
    lineGeos.length = 0;
    lineSets.length = 0;
    gridHelper = null;
    ambientLight = null;
    dirLight = null;
    camera = null;
  },
};
