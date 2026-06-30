import type { MatchPlan, Rng, SkillProfile } from "./types";
import { createRng } from "./rng";

function targetMidpoint(skill: SkillProfile): number {
  return (skill.threeDartAverage.min + skill.threeDartAverage.max) / 2;
}

function sampleLegTarget(skill: SkillProfile, rng: Rng): number {
  const midpoint = targetMidpoint(skill);
  const { below, above } = skill.threeDartAverage.deviation.leg;
  const offset = rng.next() < 0.5 ? -rng.next() * below : rng.next() * above;
  return Math.max(0, Math.round(midpoint + offset));
}

function distributeLegTargets(
  skill: SkillProfile,
  legCount: number,
  seed: number,
): number[] {
  const rng = createRng(seed);
  const midpoint = targetMidpoint(skill);
  const raw = Array.from({ length: legCount }, () => sampleLegTarget(skill, rng));
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
