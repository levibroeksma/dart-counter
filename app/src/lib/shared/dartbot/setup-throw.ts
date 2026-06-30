import { applyHitShift, sampleWeightedBucket } from "./outcome-sample";
import { boardNeighbors, OUTSIDE_SEGMENT, parseSegment } from "./segments";
import type { Rng } from "./rng";
import type {
  BullSetupOutcomes,
  ConvergenceBias,
  Segment,
  SetupOutcomes,
  SkillProfile,
} from "./types";

const SETUP_OTHER_POOL = ["3", "7", "19", "T19", "S3", "S7"] as const;

type SetupBucket =
  | "hit"
  | "neighborSingle"
  | "neighborTreble"
  | "wrongRing"
  | "neighborWrongRing"
  | "outside"
  | "other";

type SetupWeights = Record<SetupBucket, number>;

function randomFromPool(pool: readonly string[], rng: Rng): Segment {
  const index = Math.floor(rng.next() * pool.length);
  return parseSegment(pool[index] ?? pool[0]!);
}

function pickTargetTable(target: Segment, profile: SkillProfile): SetupOutcomes | BullSetupOutcomes {
  if (target.ring === "triple") return profile.setup.trebles;
  if (target.ring === "outer") return profile.setup.outerBull;
  if (target.ring === "bull") return profile.setup.bull;
  return profile.setup.singles;
}

function toSetupWeights(table: SetupOutcomes | BullSetupOutcomes): SetupWeights {
  return {
    hit: table.hit,
    neighborSingle: "neighborSingle" in table ? (table.neighborSingle ?? 0) : 0,
    neighborTreble: "neighborTreble" in table ? (table.neighborTreble ?? 0) : 0,
    wrongRing: table.wrongRing,
    neighborWrongRing: "neighborWrongRing" in table ? (table.neighborWrongRing ?? 0) : 0,
    outside: table.outside,
    other: table.other,
  };
}

function pickByBase(base: number, ringPrefix: "" | "D" | "T"): Segment {
  return parseSegment(ringPrefix ? `${ringPrefix}${base}` : String(base));
}

function resolveBullBucket(bucket: SetupBucket, target: Segment, rng: Rng): Segment {
  if (bucket === "hit") return target;
  if (bucket === "wrongRing") return parseSegment(target.label === "25" ? "50" : "25");
  if (bucket === "outside") return OUTSIDE_SEGMENT;
  return randomFromPool(SETUP_OTHER_POOL, rng);
}

function resolveSingleBucket(bucket: SetupBucket, target: Segment, rng: Rng): Segment {
  const neighbors = boardNeighbors(target.base);
  if (bucket === "hit") return parseSegment(String(target.base));
  if (bucket === "neighborSingle") {
    return pickByBase(neighbors[Math.floor(rng.next() * neighbors.length)] ?? target.base, "");
  }
  if (bucket === "wrongRing") {
    return rng.next() < 0.5 ? pickByBase(target.base, "T") : pickByBase(target.base, "D");
  }
  if (bucket === "neighborWrongRing") {
    const neighbor = neighbors[Math.floor(rng.next() * neighbors.length)] ?? target.base;
    return rng.next() < 0.5 ? pickByBase(neighbor, "D") : pickByBase(neighbor, "T");
  }
  if (bucket === "outside") return OUTSIDE_SEGMENT;
  return randomFromPool(SETUP_OTHER_POOL, rng);
}

function resolveTripleBucket(bucket: SetupBucket, target: Segment, rng: Rng): Segment {
  const neighbors = boardNeighbors(target.base);
  if (bucket === "hit") return parseSegment(`T${target.base}`);
  if (bucket === "neighborTreble") {
    return pickByBase(neighbors[Math.floor(rng.next() * neighbors.length)] ?? target.base, "T");
  }
  if (bucket === "wrongRing") {
    return rng.next() < 0.5 ? pickByBase(target.base, "") : pickByBase(target.base, "D");
  }
  if (bucket === "neighborWrongRing") {
    const neighbor = neighbors[Math.floor(rng.next() * neighbors.length)] ?? target.base;
    return rng.next() < 0.5 ? pickByBase(neighbor, "D") : pickByBase(neighbor, "");
  }
  if (bucket === "outside") return OUTSIDE_SEGMENT;
  return randomFromPool(SETUP_OTHER_POOL, rng);
}

/**
 * Samples one setup dart outcome using ring-specific setup distributions.
 */
export function throwSetupDart(
  target: Segment,
  profile: SkillProfile,
  bias: ConvergenceBias,
  rng: Rng,
): Segment {
  const baseTable = pickTargetTable(target, profile);
  const weights = applyHitShift(toSetupWeights(baseTable), "hit", bias.setupHitShift);
  const bucket = sampleWeightedBucket(weights, rng);

  if (target.ring === "outer" || target.ring === "bull") {
    return resolveBullBucket(bucket, target, rng);
  }
  if (target.ring === "triple") return resolveTripleBucket(bucket, target, rng);
  return resolveSingleBucket(bucket, target, rng);
}
