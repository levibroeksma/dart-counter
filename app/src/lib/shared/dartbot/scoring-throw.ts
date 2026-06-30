import { applyHitShift, sampleWeightedBucket } from "./outcome-sample";
import { OUTSIDE_SEGMENT, parseSegment } from "./segments";
import type { Rng } from "./rng";
import type { ConvergenceBias, Segment, SkillProfile } from "./types";

const SCORING_OTHER_POOL = ["3", "7", "19", "T19", "S3", "S7"] as const;

function randomFromPool(pool: readonly string[], rng: Rng): Segment {
  const index = Math.floor(rng.next() * pool.length);
  return parseSegment(pool[index] ?? pool[0]!);
}

function resolveScoringBucket(bucket: string, rng: Rng): Segment {
  if (bucket === "outside") return OUTSIDE_SEGMENT;
  if (bucket === "other") return randomFromPool(SCORING_OTHER_POOL, rng);
  return parseSegment(bucket);
}

/**
 * Samples one scoring dart outcome from the level profile scoring distribution.
 */
export function throwScoringDart(
  profile: SkillProfile,
  bias: ConvergenceBias,
  rng: Rng,
): Segment {
  const shifted = applyHitShift(
    profile.scoring.outcomes,
    profile.scoring.aim,
    bias.scoringHitShift,
  );
  const bucket = sampleWeightedBucket(shifted, rng);
  return resolveScoringBucket(bucket, rng);
}
