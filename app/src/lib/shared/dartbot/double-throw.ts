import { checkoutHitRateForDart } from "./checkout-hit-rate";
import { sampleWeightedBucket } from "./outcome-sample";
import { boardNeighbors, OUTSIDE_SEGMENT, parseSegment } from "./segments";
import type { Rng } from "./rng";
import type { ConvergenceBias, DoubleOutcomes, Segment, SkillProfile } from "./types";

const DOUBLE_OTHER_POOL = ["3", "7", "19", "T19", "S3", "S7"] as const;

type DoubleBucket = keyof DoubleOutcomes;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomFromPool(pool: readonly string[], rng: Rng): Segment {
  const index = Math.floor(rng.next() * pool.length);
  return parseSegment(pool[index] ?? pool[0]!);
}

function scaleDoubleOutcomes(outcomes: DoubleOutcomes, hitRate: number): Record<DoubleBucket, number> {
  const hit = hitRate * 100;
  const missKeys: DoubleBucket[] = [
    "inside",
    "neighborSingle",
    "neighborDouble",
    "outside",
    "other",
  ];
  const remaining = 100 - hit;
  const baseMissTotal = missKeys.reduce((sum, key) => sum + outcomes[key], 0);

  const scaled: Record<DoubleBucket, number> = {
    hit,
    inside: 0,
    neighborSingle: 0,
    neighborDouble: 0,
    outside: 0,
    other: 0,
  };

  let assigned = 0;
  for (let i = 0; i < missKeys.length; i += 1) {
    const key = missKeys[i]!;
    if (i === missKeys.length - 1) {
      scaled[key] = remaining - assigned;
    } else {
      const value = baseMissTotal > 0 ? (outcomes[key] / baseMissTotal) * remaining : 0;
      scaled[key] = value;
      assigned += value;
    }
  }

  return scaled;
}

function resolveDoubleBucket(bucket: DoubleBucket, target: Segment, rng: Rng): Segment {
  const neighbors = boardNeighbors(target.base);
  if (bucket === "hit") return target;
  if (bucket === "inside") return parseSegment(target.base === 50 ? "25" : String(target.base));
  if (bucket === "neighborSingle") {
    const base = neighbors[Math.floor(rng.next() * neighbors.length)] ?? target.base;
    return parseSegment(String(base));
  }
  if (bucket === "neighborDouble") {
    const base = neighbors[Math.floor(rng.next() * neighbors.length)] ?? target.base;
    return parseSegment(`D${base}`);
  }
  if (bucket === "outside") return OUTSIDE_SEGMENT;
  return randomFromPool(DOUBLE_OTHER_POOL, rng);
}

/**
 * Samples one checkout dart toward a finishing double with dynamic hit rate.
 */
export function throwDoubleDart(
  target: Segment,
  profile: SkillProfile,
  dartIndexInVisit: 1 | 2 | 3,
  bias: ConvergenceBias,
  rng: Rng,
): Segment {
  const min = profile.checkoutPercentage.min / 100;
  const max = profile.checkoutPercentage.max / 100;
  const baseRate = checkoutHitRateForDart(profile, dartIndexInVisit, rng);
  const hitRate = clamp(baseRate + bias.checkoutHitShift / 100, min, max);
  const scaled = scaleDoubleOutcomes(profile.doubles.outcomes, hitRate);
  const bucket = sampleWeightedBucket(scaled, rng);
  return resolveDoubleBucket(bucket, target, rng);
}
