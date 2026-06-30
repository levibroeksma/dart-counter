import type { LevelProfile, StatRange } from "./types";

const L1_SCORING_OUTCOMES = {
  S20: 35,
  T20: 3,
  D20: 4,
  S5: 15,
  S1: 15,
  T5: 3,
  D5: 4,
  T1: 3,
  D1: 4,
  outside: 6,
  other: 8,
};

const L5_SCORING_OUTCOMES = {
  S20: 50,
  T20: 8,
  D20: 2,
  S5: 7,
  S1: 7,
  T5: 7,
  D5: 2,
  T1: 7,
  D1: 2,
  outside: 3,
  other: 5,
};

const L10_SCORING_OUTCOMES = {
  S20: 30,
  T20: 31,
  D20: 9,
  S5: 3,
  S1: 3,
  T5: 10,
  D5: 1,
  T1: 10,
  D1: 1,
  outside: 1,
  other: 1,
};

const L1_SETUP_SINGLES = {
  hit: 16,
  neighborSingle: 26,
  wrongRing: 24,
  neighborWrongRing: 22,
  outside: 8,
  other: 4,
};

const L5_SETUP_SINGLES = {
  hit: 38,
  neighborSingle: 22,
  wrongRing: 18,
  neighborWrongRing: 14,
  outside: 5,
  other: 3,
};

const L10_SETUP_SINGLES = {
  hit: 58,
  neighborSingle: 16,
  wrongRing: 12,
  neighborWrongRing: 8,
  outside: 4,
  other: 2,
};

const L1_SETUP_TREBLES = {
  hit: 12,
  neighborTreble: 22,
  wrongRing: 32,
  neighborWrongRing: 20,
  outside: 10,
  other: 4,
};

const L5_SETUP_TREBLES = {
  hit: 28,
  neighborTreble: 20,
  wrongRing: 22,
  neighborWrongRing: 16,
  outside: 8,
  other: 6,
};

const L10_SETUP_TREBLES = {
  hit: 48,
  neighborTreble: 18,
  wrongRing: 14,
  neighborWrongRing: 10,
  outside: 6,
  other: 4,
};

const L1_OUTER_BULL = { hit: 14, wrongRing: 8, outside: 6, other: 72 };
const L5_OUTER_BULL = { hit: 28, wrongRing: 12, outside: 8, other: 52 };
const L10_OUTER_BULL = { hit: 45, wrongRing: 15, outside: 8, other: 32 };

const L1_BULL = { hit: 14, wrongRing: 36, outside: 8, other: 42 };
const L5_BULL = { hit: 26, wrongRing: 28, outside: 8, other: 38 };
const L10_BULL = { hit: 40, wrongRing: 26, outside: 6, other: 28 };

const L1_DOUBLES = {
  hit: 14,
  inside: 20,
  neighborSingle: 30,
  neighborDouble: 12,
  outside: 19,
  other: 5,
};

const L5_DOUBLES = {
  hit: 24,
  inside: 25,
  neighborSingle: 15,
  neighborDouble: 15,
  outside: 16,
  other: 5,
};

const L10_DOUBLES = {
  hit: 38,
  inside: 15,
  neighborSingle: 10,
  neighborDouble: 15,
  outside: 20,
  other: 2,
};

const L1_CONVERGENCE = {
  maxScoringHitShift: 1.5,
  maxSetupHitShift: 2,
  maxCheckoutHitShift: 2,
  distanceScale: 0.15,
};

const L5_CONVERGENCE = {
  maxScoringHitShift: 2.5,
  maxSetupHitShift: 3,
  maxCheckoutHitShift: 3,
  distanceScale: 0.2,
};

const L10_CONVERGENCE = {
  maxScoringHitShift: 3.5,
  maxSetupHitShift: 4,
  maxCheckoutHitShift: 4,
  distanceScale: 0.25,
};

function statRange(
  min: number,
  max: number,
  legBelow: number,
  legAbove: number,
  setBelow: number,
  setAbove: number,
): StatRange {
  return {
    min,
    max,
    deviation: {
      leg: { below: legBelow, above: legAbove },
      set: { below: setBelow, above: setAbove },
    },
  };
}

export const LEVEL_STAT_RANGES: Array<{
  level: number;
  threeDartAverage: StatRange;
  scoringAverage: StatRange;
  checkoutPercentage: { min: number; max: number };
}> = [
  {
    level: 1,
    threeDartAverage: statRange(30, 40, 5, 5, 3, 3),
    scoringAverage: statRange(37, 47, 6, 6, 4, 4),
    checkoutPercentage: { min: 8, max: 30 },
  },
  {
    level: 2,
    threeDartAverage: statRange(33, 43, 5, 5, 3, 3),
    scoringAverage: statRange(40, 50, 6, 6, 4, 4),
    checkoutPercentage: { min: 10, max: 30 },
  },
  {
    level: 3,
    threeDartAverage: statRange(37, 47, 5, 6, 3, 3),
    scoringAverage: statRange(43, 53, 6, 7, 4, 4),
    checkoutPercentage: { min: 10, max: 35 },
  },
  {
    level: 4,
    threeDartAverage: statRange(41, 51, 5, 6, 3, 4),
    scoringAverage: statRange(45, 55, 6, 7, 4, 5),
    checkoutPercentage: { min: 15, max: 35 },
  },
  {
    level: 5,
    threeDartAverage: statRange(45, 55, 5, 7, 3, 4),
    scoringAverage: statRange(48, 58, 6, 8, 4, 5),
    checkoutPercentage: { min: 15, max: 40 },
  },
  {
    level: 6,
    threeDartAverage: statRange(48, 58, 5, 8, 3, 4),
    scoringAverage: statRange(53, 63, 6, 9, 4, 6),
    checkoutPercentage: { min: 20, max: 40 },
  },
  {
    level: 7,
    threeDartAverage: statRange(52, 62, 5, 8, 3, 5),
    scoringAverage: statRange(57, 67, 6, 10, 4, 6),
    checkoutPercentage: { min: 20, max: 45 },
  },
  {
    level: 8,
    threeDartAverage: statRange(56, 66, 5, 9, 3, 5),
    scoringAverage: statRange(60, 70, 6, 11, 4, 7),
    checkoutPercentage: { min: 25, max: 45 },
  },
  {
    level: 9,
    threeDartAverage: statRange(64, 74, 5, 10, 3, 6),
    scoringAverage: statRange(68, 78, 6, 12, 4, 8),
    checkoutPercentage: { min: 30, max: 50 },
  },
  {
    level: 10,
    threeDartAverage: statRange(67, 77, 5, 10, 3, 6),
    scoringAverage: statRange(75, 85, 6, 12, 4, 8),
    checkoutPercentage: { min: 30, max: 50 },
  },
];

export const ANCHOR_PROFILES: LevelProfile[] = [
  {
    ...LEVEL_STAT_RANGES[0]!,
    scoring: { aim: "S20", outcomes: L1_SCORING_OUTCOMES },
    setup: {
      singles: L1_SETUP_SINGLES,
      trebles: L1_SETUP_TREBLES,
      outerBull: L1_OUTER_BULL,
      bull: L1_BULL,
    },
    doubles: { outcomes: L1_DOUBLES },
    convergence: L1_CONVERGENCE,
  },
  {
    ...LEVEL_STAT_RANGES[4]!,
    scoring: { aim: "T20", outcomes: L5_SCORING_OUTCOMES },
    setup: {
      singles: L5_SETUP_SINGLES,
      trebles: L5_SETUP_TREBLES,
      outerBull: L5_OUTER_BULL,
      bull: L5_BULL,
    },
    doubles: { outcomes: L5_DOUBLES },
    convergence: L5_CONVERGENCE,
  },
  {
    ...LEVEL_STAT_RANGES[9]!,
    scoring: { aim: "T20", outcomes: L10_SCORING_OUTCOMES },
    setup: {
      singles: L10_SETUP_SINGLES,
      trebles: L10_SETUP_TREBLES,
      outerBull: L10_OUTER_BULL,
      bull: L10_BULL,
    },
    doubles: { outcomes: L10_DOUBLES },
    convergence: L10_CONVERGENCE,
  },
];
