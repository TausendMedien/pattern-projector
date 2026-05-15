import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface PersonPoints {
  x: number; // normalized 0–1, mirrored (left hand = left side)
  y: number; // normalized 0–1, y=0 top
  z: number; // MediaPipe z relative to hip distance; negative = closer to camera
}

// Mutable singleton — patterns read this directly in their update() loop every frame.
export const poseState = {
  persons: [] as PersonPoints[][],  // persons[i] = [leftWrist, rightWrist, hipCenter]
  active: false,
};

let landmarker: PoseLandmarker | null = null;
let video: HTMLVideoElement | null = null;
let rafId = 0;

export async function getPoseCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const all = devices.filter((d) => d.kind === "videoinput");
    const labelled = all.filter((d) => d.label);
    return labelled.length > 0 ? labelled : all;
  } catch {
    return [];
  }
}

export async function startPoseTracking(deviceId?: string): Promise<void> {
  if (poseState.active) return;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 5,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  video = document.createElement("video");
  video.width = 640;
  video.height = 480;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  const constraints: MediaStreamConstraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
      : { width: 640, height: 480, facingMode: "user" },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await new Promise<void>((resolve) => { video!.onloadeddata = () => resolve(); });

  poseState.active = true;
  startDetectionLoop();
}

// Switch the camera stream without recreating the landmarker (fast camera switching).
export async function switchPoseCamera(deviceId?: string): Promise<void> {
  if (!video) return;
  if (video.srcObject) {
    (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  const constraints: MediaStreamConstraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
      : { width: 640, height: 480, facingMode: "user" },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await new Promise<void>((resolve) => { video!.onloadeddata = () => resolve(); });
}

export function stopPoseTracking(): void {
  poseState.active = false;
  cancelAnimationFrame(rafId);
  poseState.persons = [];
  if (video?.srcObject) {
    (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
  video = null;
  landmarker?.close();
  landmarker = null;
}

function extractRaw(lms: { x: number; y: number; z: number }[]): PersonPoints[] {
  const lw = lms[15]; const rw = lms[16];
  const lh = lms[23]; const rh = lms[24];
  return [
    { x: 1 - lw.x, y: lw.y, z: lw.z },
    { x: 1 - rw.x, y: rw.y, z: rw.z },
    { x: 1 - (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: (lh.z + rh.z) / 2 },
  ];
}

// Reorder raw detections to best match the previous frame's person ordering.
// This prevents EMA from jumping when MediaPipe shuffles person indices.
function matchPersons(raw: PersonPoints[][], prev: PersonPoints[][]): PersonPoints[][] {
  if (prev.length === 0 || raw.length === 0) return raw;
  const result: PersonPoints[][] = new Array(raw.length);
  const rawUsed = new Set<number>();
  let nextSlot = 0;
  for (let pi = 0; pi < prev.length && nextSlot < raw.length; pi++) {
    const ph = prev[pi][2]; // hip center
    let bestIdx = -1; let bestDist = Infinity;
    for (let ri = 0; ri < raw.length; ri++) {
      if (rawUsed.has(ri)) continue;
      const rh = raw[ri][2];
      const d = (rh.x - ph.x) ** 2 + (rh.y - ph.y) ** 2;
      if (d < bestDist) { bestDist = d; bestIdx = ri; }
    }
    if (bestIdx >= 0) { result[nextSlot++] = raw[bestIdx]; rawUsed.add(bestIdx); }
  }
  for (let ri = 0; ri < raw.length; ri++) {
    if (!rawUsed.has(ri)) result[nextSlot++] = raw[ri];
  }
  return result;
}

function startDetectionLoop() {
  const ALPHA = 0.18;
  const HOLD_FRAMES = 8;
  let lastVideoTime = -1;
  let smoothed: PersonPoints[][] = [];
  let lastSmoothed: PersonPoints[][] = [];
  let holdCounter = 0;

  function detect() {
    if (!landmarker || !video || !poseState.active) return;
    if (video.readyState < 2) { rafId = requestAnimationFrame(detect); return; }

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = landmarker.detectForVideo(video, performance.now());

      if (results.landmarks.length > 0) {
        holdCounter = 0;
        const raw = results.landmarks.map(extractRaw);
        const matched = matchPersons(raw, lastSmoothed);

        // When count changes, seed smooth buffer from lastSmoothed for continuity
        if (matched.length !== smoothed.length) {
          smoothed = matched.map((person, pi) =>
            person.map((pt, ji) => ({
              x: lastSmoothed[pi]?.[ji]?.x ?? pt.x,
              y: lastSmoothed[pi]?.[ji]?.y ?? pt.y,
              z: lastSmoothed[pi]?.[ji]?.z ?? pt.z,
            }))
          );
        }

        smoothed = matched.map((person, pi) =>
          person.map((pt, ji) => ({
            x: ALPHA * pt.x + (1 - ALPHA) * (smoothed[pi]?.[ji]?.x ?? pt.x),
            y: ALPHA * pt.y + (1 - ALPHA) * (smoothed[pi]?.[ji]?.y ?? pt.y),
            z: ALPHA * pt.z + (1 - ALPHA) * (smoothed[pi]?.[ji]?.z ?? pt.z),
          }))
        );
        lastSmoothed = smoothed;
        poseState.persons = smoothed;
      } else {
        holdCounter++;
        if (holdCounter < HOLD_FRAMES && lastSmoothed.length > 0) {
          // Hold last known positions during brief dropout to absorb 1-frame misses
          poseState.persons = lastSmoothed;
        } else {
          smoothed = [];
          lastSmoothed = [];
          poseState.persons = [];
        }
      }
    }
    rafId = requestAnimationFrame(detect);
  }
  rafId = requestAnimationFrame(detect);
}
