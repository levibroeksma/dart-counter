import type { MatchPlan, SkillProfile } from "@lib/shared/dartbot/types";
import { createRng } from "@lib/shared/dartbot/rng";

function targetMidpoint(skill: SkillProfile): number {
  return (skill.threeDartAverage.min + skill.threeDartAverage.max) / 2;
}

function distributeLegTargets(
  skill: SkillProfile,
  legCount: number,
  seed: number,
): number[] {
  const rng = createRng(seed);
  const midpoint = targetMidpoint(skill);
  const variance = skill.execution.variance;
  const raw = Array.from({ length: legCount }, () => {
    const offset = (rng.next() - 0.5) * 2 * variance;
    return Math.max(0, Math.round(midpoint + offset));
  });
  const avg = raw.reduce((a, b) => a + b, 0) / raw.length;
  const correction = Math.round(midpoint - avg);
  return raw.map((v) => Math.max(0, v + correction));
}

export function generateMatchPlan(
  skill: SkillProfile,
  legCount: number,
  seed: number,
): MatchPlan & { extendLegTargets: (n: number) => number[] } {
  const legTargets = distributeLegTargets(skill, legCount, seed);
  return {
    legTargets,
    skill,
    seed,
    extendLegTargets(totalLegs: number) {
      if (totalLegs <= legTargets.length) return legTargets.slice(0, totalLegs);
      const extra = distributeLegTargets(
        skill,
        totalLegs - legTargets.length,
        seed + legTargets.length,
      );
      return [...legTargets, ...extra];
    },
  };
}
