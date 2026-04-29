import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

// Controls state
let threshold = 0.3;
let decayRate = 0.03;   // 0 = forever, >0 = fade per frame
let gain = 2.5;
let dimLevel = 0.25;
let bgMode = 0;         // 0=black, 1=live, 2=dimmed
let clearRequested = false;

// THREE objects
let _renderer: THREE.WebGLRenderer | null = null;

// Video / texture
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let videoTexture: THREE.VideoTexture | null = null;
let blackTexture: THREE.DataTexture | null = null;
let cameraReady = false;

// Ping-pong render targets
let trailA: THREE.WebGLRenderTarget | null = null;
let trailB: THREE.WebGLRenderTarget | null = null;

// Accumulation pass (offscreen scene)
let accumScene: THREE.Scene | null = null;
let accumCamera: THREE.OrthographicCamera | null = null;
let accumGeometry: THREE.PlaneGeometry | null = null;
let accumMaterial: THREE.ShaderMaterial | null = null;

// Composite pass (main scene)
let compositeGeometry: THREE.PlaneGeometry | null = null;
let compositeMaterial: THREE.ShaderMaterial | null = null;
let compositeMesh: THREE.Mesh | null = null;

// DOM overlay
let overlay: HTMLDivElement | null = null;

// ─── Shaders ────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const accumFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTrail;
  uniform sampler2D uLiveFrame;
  uniform float uThreshold;
  uniform float uDecay;
  uniform float uGain;
  uniform float uClear;

  void main() {
    vec4 trail = texture2D(uTrail, vUv);
    vec4 live  = texture2D(uLiveFrame, vUv);

    float luma = dot(live.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Proportional: weight scales linearly from 0 at threshold to 1 at full brightness.
    // This preserves color and means dim lights contribute proportionally less than
    // bright ones — a dim light above threshold won't stack to full white.
    float weight = clamp((luma - uThreshold) / max(1.0 - uThreshold, 0.01), 0.0, 1.0);
    weight = weight * weight; // square for more natural falloff near threshold

    // Scale live color by weight * gain, but normalize so no channel exceeds 1
    // before adding — this prevents bright white lights washing out their own color.
    vec3 contribution = live.rgb * weight * uGain;
    float maxCh = max(max(contribution.r, contribution.g), contribution.b);
    if (maxCh > 1.0) contribution /= maxCh;

    // uDecay == 0 means keep forever; otherwise fade
    vec3 decayed = trail.rgb * (1.0 - uDecay);

    vec3 newTrail = mix(clamp(decayed + contribution, 0.0, 1.0), vec3(0.0), uClear);
    gl_FragColor = vec4(newTrail, 1.0);
  }
`;

const compositeFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTrail;
  uniform sampler2D uLiveFrame;
  uniform float uBgMode;
  uniform float uDimLevel;
  uniform float uThreshold;

  void main() {
    vec4 trail = texture2D(uTrail, vUv);
    vec4 live  = texture2D(uLiveFrame, vUv);

    float luma = dot(live.rgb, vec3(0.2126, 0.7152, 0.0722));
    // Dim background pixels based on how far below threshold they are
    float darkness = 1.0 - smoothstep(0.0, uThreshold, luma);

    float t01 = clamp(uBgMode, 0.0, 1.0);
    float t12 = clamp(uBgMode - 1.0, 0.0, 1.0);
    vec3 bg = mix(vec3(0.0), live.rgb, t01);
    bg = mix(bg, live.rgb * uDimLevel * darkness, t12);

    gl_FragColor = vec4(clamp(bg + trail.rgb, 0.0, 1.0), 1.0);
  }
`;

// ─── Camera ──────────────────────────────────────────────────────────────────

async function startCamera(canvas: HTMLCanvasElement) {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      audio: false,
    });
    video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("playsinline", "");
    video.muted = true;
    await video.play();
    videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    cameraReady = true;
    overlay?.remove();
    overlay = null;
  } catch {
    cameraReady = false;
    showOverlay(canvas, "Camera access denied.\nAllow camera in browser settings and reload.");
  }
}

function showOverlay(canvas: HTMLCanvasElement, message: string) {
  overlay?.remove();
  const div = document.createElement("div");
  div.style.cssText = `
    position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    color:#fff;font-family:sans-serif;font-size:16px;text-align:center;
    pointer-events:none;white-space:pre-line;padding:24px;
    background:rgba(0,0,0,0.55);
  `;
  div.textContent = message;
  canvas.parentElement?.appendChild(div);
  overlay = div;
}

// ─── Pattern ─────────────────────────────────────────────────────────────────

export const lightTrail: Pattern = {
  id: "lightTrail",
  name: "Light Trail",

  controls: [
    {
      label: "Threshold",
      type: "range", min: 0.05, max: 0.95, step: 0.01,
      get: () => threshold,
      set: (v) => { threshold = v; },
    },
    {
      label: "Fade Speed",
      type: "range", min: 0.0, max: 0.05, step: 0.001,
      get: () => decayRate,
      set: (v) => { decayRate = v; },
    },
    {
      label: "Gain",
      type: "range", min: 0.5, max: 8.0, step: 0.1,
      get: () => gain,
      set: (v) => { gain = v; },
    },
    {
      label: "Dim Level",
      type: "range", min: 0.0, max: 1.0, step: 0.05,
      get: () => dimLevel,
      set: (v) => { dimLevel = v; },
    },
    {
      label: "Background",
      type: "select", options: ["Black", "Live", "Dimmed"],
      get: () => bgMode,
      set: (v) => { bgMode = v; },
    },
    {
      label: "Clear Trails",
      type: "button",
      action: () => { clearRequested = true; },
    },
  ],

  init(ctx: PatternContext) {
    _renderer = ctx.renderer;
    const { width, height } = ctx.size;
    const canvas = ctx.renderer.domElement;

    blackTexture = new THREE.DataTexture(
      new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat
    );
    blackTexture.needsUpdate = true;

    const rtOpts: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    trailA = new THREE.WebGLRenderTarget(width, height, rtOpts);
    trailB = new THREE.WebGLRenderTarget(width, height, rtOpts);

    accumScene = new THREE.Scene();
    accumCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    accumGeometry = new THREE.PlaneGeometry(2, 2);
    accumMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTrail:     { value: blackTexture },
        uLiveFrame: { value: blackTexture },
        uThreshold: { value: threshold },
        uDecay:     { value: decayRate },
        uGain:      { value: gain },
        uClear:     { value: 0.0 },
      },
      vertexShader,
      fragmentShader: accumFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const accumMesh = new THREE.Mesh(accumGeometry, accumMaterial);
    accumMesh.frustumCulled = false;
    accumScene.add(accumMesh);

    compositeGeometry = new THREE.PlaneGeometry(2, 2);
    compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTrail:     { value: trailA.texture },
        uLiveFrame: { value: blackTexture },
        uBgMode:    { value: bgMode },
        uDimLevel:  { value: dimLevel },
        uThreshold: { value: threshold },
      },
      vertexShader,
      fragmentShader: compositeFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    compositeMesh = new THREE.Mesh(compositeGeometry, compositeMaterial);
    compositeMesh.frustumCulled = false;
    ctx.scene.add(compositeMesh);

    showOverlay(canvas, "Requesting camera access…");
    startCamera(canvas);
  },

  update(_dt, _elapsed) {
    if (!_renderer || !accumMaterial || !compositeMaterial) return;

    const liveTex = cameraReady && videoTexture ? videoTexture : blackTexture!;
    if (cameraReady && videoTexture) videoTexture.needsUpdate = true;

    const doClear = clearRequested ? 1.0 : 0.0;
    clearRequested = false;

    accumMaterial.uniforms.uTrail.value     = trailA!.texture;
    accumMaterial.uniforms.uLiveFrame.value = liveTex;
    accumMaterial.uniforms.uThreshold.value = threshold;
    accumMaterial.uniforms.uDecay.value     = decayRate;
    accumMaterial.uniforms.uGain.value      = gain;
    accumMaterial.uniforms.uClear.value     = doClear;

    _renderer.setRenderTarget(trailB);
    _renderer.render(accumScene!, accumCamera!);
    _renderer.setRenderTarget(null);

    [trailA, trailB] = [trailB!, trailA!];

    compositeMaterial.uniforms.uTrail.value     = trailA.texture;
    compositeMaterial.uniforms.uLiveFrame.value = liveTex;
    compositeMaterial.uniforms.uBgMode.value    = bgMode;
    compositeMaterial.uniforms.uDimLevel.value  = dimLevel;
    compositeMaterial.uniforms.uThreshold.value = threshold;
  },

  resize(width, height) {
    trailA?.setSize(width, height);
    trailB?.setSize(width, height);
  },

  dispose() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (video) { video.pause(); video.srcObject = null; }
    video = null;
    videoTexture?.dispose();
    videoTexture = null;
    blackTexture?.dispose();
    blackTexture = null;
    cameraReady = false;

    trailA?.dispose(); trailA = null;
    trailB?.dispose(); trailB = null;

    accumGeometry?.dispose(); accumGeometry = null;
    accumMaterial?.dispose(); accumMaterial = null;
    accumScene = null; accumCamera = null;

    compositeGeometry?.dispose(); compositeGeometry = null;
    compositeMaterial?.dispose(); compositeMaterial = null;
    compositeMesh = null;

    overlay?.remove(); overlay = null;
    _renderer = null;
  },
};
