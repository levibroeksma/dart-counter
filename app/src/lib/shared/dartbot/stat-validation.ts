import type { StatRange } from "./types";

export function isWithinStatBand(
  actual: number,
  range: StatRange,
  scope: "leg" | "set",
): boolean {
  const d = range.deviation[scope];
  return actual >= range.min - d.below && actual <= range.max + d.above;
}
