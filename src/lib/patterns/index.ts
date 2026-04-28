import type { Pattern } from "./types";
import { lines3d } from "./lines3d";
import { particles } from "./particles";
import { tunnel } from "./tunnel";
import { shaderGradient } from "./shaderGradient";
import { parallelLinesStraight } from "./parallelLinesStraight";
import { parallelLinesWave } from "./parallelLinesWave";
import { hyperMix } from "./hyperMix";

export const patterns: Pattern[] = [
  lines3d,
  particles,
  tunnel,
  shaderGradient,
  parallelLinesStraight,
  parallelLinesWave,
  hyperMix,
];
