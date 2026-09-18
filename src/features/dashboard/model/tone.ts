/**
 * Status vocabulary for telemetry readouts.
 *
 * Device state is described with the orthogonal status colours (success /
 * warning / danger); the accent stays reserved for UI emphasis. `neutral` maps
 * to the chart ramp's primary series, which is what a plain measurement is.
 */
export type Tone = "ok" | "warn" | "danger" | "neutral";

export const TONE_TEXT: Record<Tone, string> = {
  danger: "text-destructive",
  neutral: "text-muted-foreground",
  ok: "text-success",
  warn: "text-warning",
};

export const TONE_FILL: Record<Tone, string> = {
  danger: "bg-destructive",
  neutral: "bg-chart-1",
  ok: "bg-success",
  warn: "bg-warning",
};

export const TONE_STROKE: Record<Tone, string> = {
  danger: "stroke-destructive",
  neutral: "stroke-chart-1",
  ok: "stroke-success",
  warn: "stroke-warning",
};

const USAGE_DANGER = 0.9;
const USAGE_WARN = 0.75;

/** A volume that is nearly full is a problem long before it is exactly full. */
export const usageTone = (ratio: number): Tone => {
  if (ratio >= USAGE_DANGER) {
    return "danger";
  }
  if (ratio >= USAGE_WARN) {
    return "warn";
  }
  return "neutral";
};

const BATTERY_DANGER_PCT = 15;
const BATTERY_WARN_PCT = 30;

/** Charging is always fine — a phone at 8% on the cable is not a warning. */
export const batteryTone = (levelPct: number | null, isCharging: boolean): Tone => {
  if (levelPct === null) {
    return "neutral";
  }
  if (isCharging) {
    return "ok";
  }
  if (levelPct <= BATTERY_DANGER_PCT) {
    return "danger";
  }
  if (levelPct <= BATTERY_WARN_PCT) {
    return "warn";
  }
  return "ok";
};
