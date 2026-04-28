import type { Pattern } from "./types";
import { lines3d } from "./lines3d";
import { particles } from "./particles";
import { tunnel } from "./tunnel";
import { shaderGradient } from "./shaderGradient";
import { parallelLinesStraight } from "./parallelLinesStraight";
import { parallelLinesWave } from "./parallelLinesWave";
import { hyperMix } from "./hyperMix";
import { dotRain } from "./dotRain";
import { flowLines } from "./flowLines";

export const patterns: Pattern[] = [
  particles,
  parallelLinesStraight,
  parallelLinesWave,
  dotRain,
  flowLines,
  shaderGradient,
  hyperMix,
  tunnel,
  lines3d,
];
