import type { Rng } from "./rng";
import type { SkillProfile } from "./types";

/**
 * Samples a per-dart checkout hit probability inside the level checkout band.
 */
export function checkoutHitRateForDart(
  profile: SkillProfile,
  dartIndexInVisit: 1 | 2 | 3,
  rng: Rng,
): number {
  const min = profile.checkoutPercentage.min / 100;
  const max = profile.checkoutPercentage.max / 100;
  const width = (max - min) / 3;
  const sliceIndex = dartIndexInVisit - 1;
  const sliceMin = min + sliceIndex * width;
  const sliceMax = dartIndexInVisit === 3 ? max : sliceMin + width;
  return sliceMin + rng.next() * (sliceMax - sliceMin);
}
