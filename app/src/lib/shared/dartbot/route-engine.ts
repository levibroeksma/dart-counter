import { parseSegment } from "./segments";
import type { Segment, SkillProfile } from "./types";
import type { Rng } from "./rng";

export function chooseScoringTarget(input: {
  skill: SkillProfile;
  legTarget: number;
  rng: Rng;
}): Segment {
  const { skill, legTarget, rng } = input;
  const pressure =
    legTarget - (skill.scoringAverage.min + skill.scoringAverage.max) / 2;
  const roll = rng.next();
  if (pressure > 10 && roll < skill.execution.missSpread * 0.3) {
    return parseSegment("T19");
  }
  if (pressure > 20 && roll < skill.execution.missSpread * 0.15) {
    return parseSegment("T18");
  }
  if (skill.level >= 12 && roll < 0.02) {
    return parseSegment("50");
  }
  return parseSegment("T20");
}
