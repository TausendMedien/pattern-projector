// Generic motion-camera wrapper.
// Wraps any Pattern, appends Motion Detection Camera controls, and multiplies
// the dt passed to update() so every time-based animation speeds up when the
// camera detects person motion. Uses the Spatial Patchiness detector.

import type { Pattern, PatternControl, PatternContext } from "./patterns/types";
import { MotionCamera, SpatialPatchinessDetector, showMotionOverlay } from "./motionDetector";

export function addMotionCamera(pattern: Pattern): Pattern {
  // ── State ──────────────────────────────────────────────────────────────────
  let sensitivity    = 10;   // restored by wrapWithPersist
  let cameraEnabled  = false; // restored by wrapWithPersist
  let deviceIndex    = 0;    // restored by wrapWithPersist
  let motionDisplay  = 0;
  let smoothedMotion = 0;

  let cameraDevices: MediaDeviceInfo[] = [];
  const cameraNames = (): string[] =>
    cameraDevices.length > 0
      ? cameraDevices.map((d, i) => d.label || `Camera ${i + 1}`)
      : ['Rear / External', 'Front'];

  let motionCamera: MotionCamera | null = null;
  const detector = new SpatialPatchinessDetector();
  let canvasRef: HTMLCanvasElement | null = null;
  let overlay: HTMLDivElement | null = null;

  // ── Camera helpers ─────────────────────────────────────────────────────────

  async function refreshDeviceList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const all = devices.filter((d) => d.kind === 'videoinput');
      const labelled = all.filter((d) => d.label);
      cameraDevices = labelled.length > 0 ? labelled : all;
    } catch { /* ignore */ }
  }

  const onDeviceChange = () => { refreshDeviceList(); };

  function startCamera() {
    motionCamera?.dispose();
    motionCamera = null;
    if (!canvasRef) return;
    const device = cameraDevices[deviceIndex];
    const constraints: MediaStreamConstraints = {
      video: device
        ? { deviceId: { exact: device.deviceId }, width: { ideal: 320 }, height: { ideal: 180 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 180 } },
      audio: false,
    };
    overlay = showMotionOverlay(canvasRef, 'Requesting camera…');
    MotionCamera.createWithConstraints(canvasRef, constraints).then(async (cam) => {
      overlay?.remove();
      overlay = null;
      motionCamera = cam ?? null;
      if (cam) {
        await refreshDeviceList();
        navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
      }
    });
  }

  function enableCamera(on: boolean) {
    cameraEnabled = on;
    if (on) {
      startCamera();
    } else {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      motionCamera?.dispose();
      motionCamera = null;
      smoothedMotion = 0;
      motionDisplay  = 0;
      overlay?.remove();
      overlay = null;
    }
  }

  // ── Extra controls appended after pattern's own controls ───────────────────
  const motionControls: PatternControl[] = [
    {
      label: 'Motion Detection Camera',
      type:  'section',
      get: () => cameraEnabled,
      set: (v) => enableCamera(v),
    },
    {
      label: 'Motion Sensitivity',
      type: 'range', min: 0, max: 100, step: 1,
      get: () => sensitivity,
      set: (v) => { sensitivity = v; },
    },
    {
      label: 'Motion Level',
      type: 'range', min: 0, max: 100, step: 1,
      readonly: true,
      get: () => motionDisplay,
      set: () => {},
    },
    {
      label: 'Camera',
      type: 'select',
      options: cameraNames,
      get: () => deviceIndex,
      set: (v) => {
        deviceIndex = v;
        if (cameraEnabled) startCamera();
      },
    },
  ];

  // ── Wrapped pattern ────────────────────────────────────────────────────────
  return {
    ...pattern,
    controls: [...(pattern.controls ?? []), ...motionControls],

    init(ctx: PatternContext) {
      canvasRef = ctx.renderer.domElement;
      pattern.init(ctx);
      if (cameraEnabled) startCamera();
    },

    update(dt: number, elapsed: number) {
      // Motion detection
      if (motionCamera) {
        const diff = motionCamera.tick();
        if (diff) {
          const raw = Math.min(detector.update(diff), 1.0);
          smoothedMotion = raw > smoothedMotion
            ? 0.90 * smoothedMotion + 0.10 * raw
            : 0.97 * smoothedMotion + 0.03 * raw;
        }
      }
      motionDisplay = Math.round(smoothedMotion * 100);

      // Exponential boost curve — same formula as particleFieldBase
      const boost = sensitivity > 0
        ? smoothedMotion * Math.pow(sensitivity / 10, 1.4) * 0.5
        : 0;

      // Multiply dt: all time-based patterns run faster with motion
      pattern.update(dt * (1 + boost * 2.0), elapsed);
    },

    resize(width: number, height: number) {
      pattern.resize(width, height);
    },

    dispose() {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      motionCamera?.dispose();
      motionCamera = null;
      overlay?.remove();
      overlay = null;
      smoothedMotion = 0;
      canvasRef = null;
      pattern.dispose();
    },
  };
}
