import { IntensityLevel } from "@/types/common";

/**
 * Single source of truth for "what counts as clean / moderate / high".
 * Every component that colors a value by carbon intensity calls this —
 * never hardcode a threshold at the call site.
 */
export function classifyIntensity(carbonG: number): IntensityLevel {
  if (carbonG < 250) return "clean";
  if (carbonG < 500) return "moderate";
  return "high";
}

// Position (0-100%) of a value along a fixed 0-25kg spectrum, for the
// FleetCard marker.
export function spectrumPosition(valueKg: number, maxKg = 25): number {
  const clamped = Math.min(Math.max(valueKg, 0), maxKg);
  return (clamped / maxKg) * 100;
}
