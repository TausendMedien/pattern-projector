import type { Pattern } from "./types";
import { lines3d } from "./lines3d";
import { particles } from "./particles";
import { particlesBody } from "./particlesBody";
import { particleLines } from "./particleLines";
import { tunnel } from "./tunnel";
import { tunnelEdge } from "./tunnelEdge";
import { shaderGradient } from "./shaderGradient";
import { parallelLinesStraight } from "./parallelLinesStraight";
import { parallelLinesWave } from "./parallelLinesWave";
import { hyperMix } from "./hyperMix";
import { dotRain } from "./dotRain";
import { dotRainBody } from "./dotRainBody";
import { flowLines } from "./flowLines";
import { pearlFlow } from "./pearlFlow";
import { curlOrbs } from "./curlOrbs";
import { curlOrbsBody } from "./curlOrbsBody";
import { flowDots } from "./flowDots";
import { baroqueSwirls } from "./baroqueSwirls";
import { baroqueSwirlsBody } from "./baroqueSwirlsBody";
import { poseDepth3d } from "./poseDepth3d";
import { lightTrail } from "./light-trail";
import { lightPaint } from "./light-paint";
import { warpedSurfaces } from "./warpedSurfaces";
import { wavySphere } from "./wavySphere";
import { plasmaSphere } from "./plasmaSphere";
import { crystalGem } from "./crystalGem";
import { asciiSwirls } from "./asciiSwirls";
import { typography3d } from "./typography3d";
import { wrapWithPersist } from "../persist";
import { addMotionCamera } from "../motionCameraWrapper";
import { addAudioReactivity } from "../audioReactivityWrapper";
import { addPoseCamera } from "../poseCameraWrapper";

// Body-tracking patterns use the pose camera wrapper instead of the motion camera wrapper.
const POSE_CAMERA = new Set(['particlesBody', 'dotRainBody', 'baroqueSwirlsBody', 'curlOrbsBody', 'poseDepth3d']);

// Patterns that must NOT get the generic motion camera wrapper.
const NO_MOTION_CAMERA = new Set([
  ...POSE_CAMERA,
  'lightTrail', 'lightPaint', 'asciiSwirls', 'typography3d',
]);

// Patterns that skip audio reactivity wrapping (camera-based patterns)
const NO_AUDIO = new Set(['lightTrail', 'lightPaint']);

const rawPatterns: Pattern[] = [
  particles,
  particlesBody,
  particleLines,
  parallelLinesStraight,
  parallelLinesWave,
  flowLines,
  curlOrbs,
  curlOrbsBody,
  tunnel,
  tunnelEdge,
  baroqueSwirls,
  baroqueSwirlsBody,
  poseDepth3d,
  shaderGradient,
  warpedSurfaces,
  hyperMix,
  lines3d,
  asciiSwirls,
  dotRain,
  dotRainBody,
  pearlFlow,
  flowDots,
  wavySphere,
  plasmaSphere,
  crystalGem,
  typography3d,
  lightTrail,
  lightPaint,
];

export const patterns: Pattern[] = rawPatterns
  .map(p => POSE_CAMERA.has(p.id) ? addPoseCamera(p) : p)
  .map(p => NO_MOTION_CAMERA.has(p.id) ? p : addMotionCamera(p))
  .map(p => NO_AUDIO.has(p.id) ? p : addAudioReactivity(p))
  .map(wrapWithPersist);
