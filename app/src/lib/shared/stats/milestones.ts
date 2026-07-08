import type { VisitMilestoneCounts } from "./types";

export function countVisitMilestones(scores: number[]): VisitMilestoneCounts {
  let visits100Plus = 0;
  let visits120Plus = 0;
  let visits140Plus = 0;
  let visits180 = 0;

  for (const score of scores) {
    if (score >= 100) visits100Plus += 1;
    if (score >= 120) visits120Plus += 1;
    if (score >= 140) visits140Plus += 1;
    if (score >= 180) visits180 += 1;
  }

  return { visits100Plus, visits120Plus, visits140Plus, visits180 };
}
