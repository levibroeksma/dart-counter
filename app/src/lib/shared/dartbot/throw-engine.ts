import type { Segment, SkillProfile } from "./types";
import type { Rng } from "./rng";
import { throwScoringDart } from "./scoring-throw";
import { throwSetupDart } from "./setup-throw";
import { throwDoubleDart } from "./double-throw";
import type { ConvergenceBias, ThrowIntent } from "./types";

function isDoubleOrBull(segment: Segment): boolean {
  return segment.ring === "double" || segment.ring === "bull";
}

/**
 * Dispatches throw simulation to scoring, setup, or checkout engines.
 */
export function throwDart(
  target: Segment,
  profile: SkillProfile,
  intent: ThrowIntent,
  dartIndexInVisit: 1 | 2 | 3,
  bias: ConvergenceBias,
  rng: Rng,
): Segment {
  if (intent === "score") {
    return throwScoringDart(profile, bias, rng);
  }
  if (intent === "checkout" && isDoubleOrBull(target)) {
    return throwDoubleDart(target, profile, dartIndexInVisit, bias, rng);
  }
  return throwSetupDart(target, profile, bias, rng);
}
