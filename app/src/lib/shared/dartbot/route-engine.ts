import { parseSegment } from "./segments";
import type { Segment, SkillProfile } from "./types";
import type { Rng } from "./rng";

const SCORING_TARGETS = ["T20", "T19", "T18"] as const;

/**
 * Selects a scoring bed. Bots aim at treble 20 by default; lower levels shift
 * toward T19/T18. Realistic score spread comes from miss-resolver on adjacent beds.
 */
export function chooseScoringTarget(input: {
  skill: SkillProfile;
  legTarget: number;
  rng: Rng;
}): Segment {
  const { skill, legTarget, rng } = input;
  const roll = rng.next();

  if (skill.level >= 10 && roll < 0.02) {
    return parseSegment("50");
  }

  const targets = SCORING_TARGETS.map((label) => parseSegment(label));
  const legPressure = Math.max(0, Math.min(1, (70 - legTarget) / 40));
  const missSpread = (10 - skill.level) / 10;
  const spreadBias = missSpread * 0.5 + legPressure * 0.3;

  if (roll < 0.7 - spreadBias) return targets[0]!;
  if (roll < 0.9 - spreadBias * 0.5) return targets[1]!;
  return targets[2]!;
}
