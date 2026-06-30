import type { Segment } from "./types";
import type { Rng } from "./rng";

export function resolveMiss(
  target: Segment,
  missSpread: number,
  rng: Rng,
): Segment {
  const candidates = target.adjacent.length > 0 ? target.adjacent : [target];
  const idx =
    Math.floor(rng.next() * candidates.length * (1 + missSpread)) %
    candidates.length;
  return candidates[idx]!;
}
