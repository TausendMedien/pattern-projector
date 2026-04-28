import { z } from "zod";
import type { Pattern } from "./patterns/types";

const STORAGE_KEY = "pattern-projector-settings";
const SETTINGS_VERSION = 1;

const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  patterns: z.record(z.string(), z.record(z.string(), z.number())),
});

type Settings = z.infer<typeof SettingsSchema>;

function readFromStorage(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return SettingsSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadSettings(patterns: Pattern[]): void {
  const settings = readFromStorage();
  if (!settings) return;

  for (const pattern of patterns) {
    const saved = settings.patterns[pattern.id];
    if (!saved || !pattern.controls) continue;
    for (const ctrl of pattern.controls) {
      if (ctrl.type === "range" && ctrl.label in saved) {
        const v = saved[ctrl.label];
        if (v >= ctrl.min && v <= ctrl.max) ctrl.set(v);
      } else if (ctrl.type === "select" && ctrl.label in saved) {
        const v = saved[ctrl.label];
        if (Number.isInteger(v) && v >= 0 && v < ctrl.options.length) ctrl.set(v);
      }
    }
  }
}

export function saveSettings(patterns: Pattern[]): void {
  const patternValues: Settings["patterns"] = {};
  for (const pattern of patterns) {
    if (!pattern.controls?.length) continue;
    const vals: Record<string, number> = {};
    for (const ctrl of pattern.controls) {
      vals[ctrl.label] = ctrl.get();
    }
    patternValues[pattern.id] = vals;
  }
  const settings: Settings = { version: SETTINGS_VERSION, patterns: patternValues };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable — silently ignore
  }
}
