import type * as THREE from "three";

export interface PatternContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  size: { width: number; height: number };
}

export type PatternControl =
  | { label: string; type: "range"; min: number; max: number; step: number; default?: number; readonly?: boolean; get(): number; set(v: number): void }
  | { label: string; type: "select"; options: string[] | (() => string[]); get(): number; set(v: number): void }
  | { label: string; type: "toggle"; get(): boolean; set(v: boolean): void }
  | { label: string; type: "separator" }
  | { label: string; type: "button"; action(): void };

export interface Pattern {
  id: string;
  name: string;
  controls?: PatternControl[];
  init(ctx: PatternContext): void;
  update(dt: number, elapsed: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
