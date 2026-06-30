import type { Segment, SkillProfile } from "@lib/shared/dartbot/types";
import type { Rng } from "@lib/shared/dartbot/rng";
import { resolveMiss } from "@lib/shared/dartbot/miss-resolver";

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
