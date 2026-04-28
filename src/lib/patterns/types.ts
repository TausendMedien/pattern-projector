import type * as THREE from "three";

export interface PatternContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  size: { width: number; height: number };
}

export interface Pattern {
  id: string;
  name: string;
  init(ctx: PatternContext): void;
  update(dt: number, elapsed: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
