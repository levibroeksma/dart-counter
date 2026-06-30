import { ANCHOR_PROFILES, LEVEL_STAT_RANGES } from "./level-profiles";
import type { LevelProfile, SkillProfile } from "./types";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function normalizeWeights(
  weights: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const scaled = entries.map(([k, w]) => [k, (w / total) * 100] as const);
  const floors = scaled.map(([k, w]) => [k, Math.floor(w)] as const);
  let remainder = 100 - floors.reduce((s, [, w]) => s + w, 0);
  const fractional = scaled
    .map(([k, w], i) => ({ k, frac: w - floors[i]![1] }))
    .sort((a, b) => b.frac - a.frac);
  const result = Object.fromEntries(floors);
  for (const { k } of fractional) {
    if (remainder <= 0) break;
    result[k] = (result[k] ?? 0) + 1;
    remainder -= 1;
  }
  return result;
}

function lerpOutcomeRecords(
  lower: Record<string, number>,
  upper: Record<string, number>,
  t: number,
): Record<string, number> {
  const keys = new Set([...Object.keys(lower), ...Object.keys(upper)]);
  const raw: Record<string, number> = {};
  for (const key of keys) {
    raw[key] = lerp(lower[key] ?? 0, upper[key] ?? 0, t);
  }
  return normalizeWeights(raw);
}

function lerpSetupOutcomes<T extends Record<string, number>>(
  lower: T,
  upper: T,
  t: number,
): T {
  return lerpOutcomeRecords(lower, upper, t) as T;
}

export function buildLevelProfile(level: number): SkillProfile {
  if (!Number.isInteger(level) || level < 1 || level > 10) {
    throw new Error(`Invalid DartBot level: ${level}`);
  }
  const anchor = ANCHOR_PROFILES.find((p) => p.level === level);
  if (anchor) {
    const { level: _l, ...rest } = anchor;
    return { level, ...rest };
  }

  const stats = LEVEL_STAT_RANGES[level - 1]!;
  const l1 = ANCHOR_PROFILES[0]!;
  const l5 = ANCHOR_PROFILES[1]!;
  const l10 = ANCHOR_PROFILES[2]!;

  let t: number;
  let lower: LevelProfile;
  let upper: LevelProfile;
  if (level <= 4) {
    t = (level - 1) / 4;
    lower = l1;
    upper = l5;
  } else {
    t = (level - 5) / 5;
    lower = l5;
    upper = l10;
  }

  return {
    level,
    threeDartAverage: stats.threeDartAverage,
    scoringAverage: stats.scoringAverage,
    checkoutPercentage: stats.checkoutPercentage,
    scoring: {
      aim: level <= 5 ? "S20" : "T20",
      outcomes: lerpOutcomeRecords(
        lower.scoring.outcomes,
        upper.scoring.outcomes,
        t,
      ),
    },
    setup: {
      singles: lerpSetupOutcomes(lower.setup.singles, upper.setup.singles, t),
      trebles: lerpSetupOutcomes(lower.setup.trebles, upper.setup.trebles, t),
      outerBull: lerpSetupOutcomes(
        lower.setup.outerBull,
        upper.setup.outerBull,
        t,
      ),
      bull: lerpSetupOutcomes(lower.setup.bull, upper.setup.bull, t),
    },
    doubles: {
      outcomes: lerpOutcomeRecords(
        lower.doubles.outcomes,
        upper.doubles.outcomes,
        t,
      ) as LevelProfile["doubles"]["outcomes"],
    },
    convergence: {
      maxScoringHitShift: lerp(
        lower.convergence.maxScoringHitShift,
        upper.convergence.maxScoringHitShift,
        t,
      ),
      maxSetupHitShift: lerp(
        lower.convergence.maxSetupHitShift,
        upper.convergence.maxSetupHitShift,
        t,
      ),
      maxCheckoutHitShift: lerp(
        lower.convergence.maxCheckoutHitShift,
        upper.convergence.maxCheckoutHitShift,
        t,
      ),
      distanceScale: lerp(
        lower.convergence.distanceScale,
        upper.convergence.distanceScale,
        t,
      ),
    },
  };
}
