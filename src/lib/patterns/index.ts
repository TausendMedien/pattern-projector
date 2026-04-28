import type { Pattern } from "./types";
import { lines3d } from "./lines3d";
import { particles } from "./particles";
import { tunnel } from "./tunnel";
import { shaderGradient } from "./shaderGradient";
import { parallelLines } from "./parallelLines";

export const patterns: Pattern[] = [lines3d, particles, tunnel, shaderGradient, parallelLines];
