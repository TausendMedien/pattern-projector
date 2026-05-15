// Wraps a Pattern with Pose Camera controls: section toggle + camera device selector.
// Replaces the motion camera wrapper for body-tracking patterns.

import type { Pattern, PatternControl, PatternContext } from "./patterns/types";
import { poseState, startPoseTracking, stopPoseTracking, switchPoseCamera, getPoseCameraDevices } from "./pose";

export function addPoseCamera(pattern: Pattern): Pattern {
  let poseEnabled = false;
  let deviceIndex = 0;
  let cameraDevices: MediaDeviceInfo[] = [];
  let ownsTracking = false;
  let starting = false;

  const cameraNames = (): string[] =>
    cameraDevices.length > 0
      ? cameraDevices.map((d, i) => d.label || `Camera ${i + 1}`)
      : ["Front", "Rear / External"];

  async function refreshDeviceList() {
    cameraDevices = await getPoseCameraDevices();
  }

  const onDeviceChange = () => { refreshDeviceList(); };

  async function startCamera() {
    if (starting) return;
    starting = true;
    try {
      if (poseState.active) {
        // Landmarker already running — just switch the video stream
        const device = cameraDevices[deviceIndex];
        await switchPoseCamera(device?.deviceId);
      } else {
        ownsTracking = true;
        const device = cameraDevices[deviceIndex];
        await startPoseTracking(device?.deviceId);
      }
      await refreshDeviceList();
      navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    } finally {
      starting = false;
    }
  }

  function enableCamera(on: boolean) {
    poseEnabled = on;
    if (on) {
      startCamera();
    } else {
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      if (ownsTracking) {
        stopPoseTracking();
        ownsTracking = false;
      }
    }
  }

  const poseControls: PatternControl[] = [
    {
      label: "Pose Camera",
      type: "section",
      get: () => poseEnabled,
      set: (v) => enableCamera(v),
    },
    {
      label: "Camera",
      type: "select",
      options: cameraNames,
      disabled: () => !poseEnabled,
      get: () => deviceIndex,
      set: (v) => {
        deviceIndex = v;
        if (poseEnabled) startCamera();
      },
    },
  ];

  return {
    ...pattern,
    controls: [...(pattern.controls ?? []), ...poseControls],

    init(ctx: PatternContext) {
      pattern.init(ctx);
    },

    activate() {
      if (poseEnabled) startCamera();
      pattern.activate?.();
    },

    update(dt: number, elapsed: number) {
      pattern.update(dt, elapsed);
    },

    resize(width: number, height: number) {
      pattern.resize(width, height);
    },

    dispose() {
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
      if (ownsTracking) {
        stopPoseTracking();
        ownsTracking = false;
      }
      pattern.dispose();
    },
  };
}
