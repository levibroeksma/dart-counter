import type { LevelProfile, SkillProfile } from "./types";

export const ANCHOR_LEVELS: LevelProfile[] = [
  {
    level: 1,
    threeDartAverage: { min: 30, max: 40 },
    scoringAverage: { min: 37, max: 47 },
    checkout: { average: 8, successRate: 0.3 },
    execution: {
      hitAccuracy: 0.25,
      missSpread: 0.45,
      checkoutDiscipline: 0.3,
      variance: 25,
    },
  },
  {
    level: 5,
    threeDartAverage: { min: 48, max: 58 },
    scoringAverage: { min: 53, max: 63 },
    checkout: { average: 20, successRate: 0.4 },
    execution: {
      hitAccuracy: 0.55,
      missSpread: 0.3,
      checkoutDiscipline: 0.55,
      variance: 18,
    },
  },
  {
    level: 10,
    threeDartAverage: { min: 67, max: 77 },
    scoringAverage: { min: 75, max: 85 },
    checkout: { average: 30, successRate: 0.55 },
    execution: {
      hitAccuracy: 0.75,
      missSpread: 0.18,
      checkoutDiscipline: 0.8,
      variance: 12,
    },
  },
  {
    level: 15,
    threeDartAverage: { min: 90, max: 999 },
    scoringAverage: { min: 95, max: 999 },
    checkout: { average: 45, successRate: 0.8 },
    execution: {
      hitAccuracy: 0.88,
      missSpread: 0.08,
      checkoutDiscipline: 0.95,
      variance: 8,
    },
  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendProfiles(
  lower: LevelProfile,
  upper: LevelProfile,
  t: number,
): SkillProfile {
  const level = Math.round(lerp(lower.level, upper.level, t));
  return {
    level,
    threeDartAverage: {
      min: lerp(lower.threeDartAverage.min, upper.threeDartAverage.min, t),
      max: lerp(lower.threeDartAverage.max, upper.threeDartAverage.max, t),
    },
    scoringAverage: {
      min: lerp(lower.scoringAverage.min, upper.scoringAverage.min, t),
      max: lerp(lower.scoringAverage.max, upper.scoringAverage.max, t),
    },
    checkout: {
      average: lerp(lower.checkout.average, upper.checkout.average, t),
      successRate: lerp(
        lower.checkout.successRate,
        upper.checkout.successRate,
        t,
      ),
    },
    execution: {
      hitAccuracy: lerp(
        lower.execution.hitAccuracy,
        upper.execution.hitAccuracy,
        t,
      ),
      missSpread: lerp(
        lower.execution.missSpread,
        upper.execution.missSpread,
        t,
      ),
      checkoutDiscipline: lerp(
        lower.execution.checkoutDiscipline,
        upper.execution.checkoutDiscipline,
        t,
      ),
      variance: lerp(lower.execution.variance, upper.execution.variance, t),
    },
  };
}

export function getSkillProfile(level: number): SkillProfile {
  if (!Number.isInteger(level) || level < 1 || level > 15) {
    throw new Error(`Invalid DartBot level: ${level}`);
  }
  const exact = ANCHOR_LEVELS.find((p) => p.level === level);
  if (exact) {
    const { level: _l, ...rest } = exact;
    return { level, ...rest };
  }
  const upperIdx = ANCHOR_LEVELS.findIndex((p) => p.level > level);
  const upper = ANCHOR_LEVELS[upperIdx]!;
  const lower = ANCHOR_LEVELS[upperIdx - 1]!;
  const t = (level - lower.level) / (upper.level - lower.level);
  return blendProfiles(lower, upper, t);
}
