import type { Segment, SkillProfile } from "./types";
import type { Rng } from "./rng";
import { resolveMiss } from "./miss-resolver";

export function throwDart(
  target: Segment,
  skill: SkillProfile,
  rng: Rng,
): Segment {
  if (rng.next() < skill.execution.hitAccuracy) {
    return target;
  }
  return resolveMiss(target, skill.execution.missSpread, rng);
}
