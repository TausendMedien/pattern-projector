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
import { pearlFlow } from "./pearlFlow";
import { curlOrbs } from "./curlOrbs";
import { flowDots } from "./flowDots";
import { baroqueSwirls } from "./baroqueSwirls";

export const patterns: Pattern[] = [
  particles,
  parallelLinesStraight,
  parallelLinesWave,
  dotRain,
  pearlFlow,
  flowDots,
  flowLines,
  curlOrbs,
  baroqueSwirls,
  shaderGradient,
  hyperMix,
  tunnel,
  lines3d,
];
