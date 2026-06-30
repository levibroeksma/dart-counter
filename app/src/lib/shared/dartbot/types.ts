export type SegmentLabel = string;

export type Segment = {
  label: SegmentLabel;
  score: number;
  ring: "single" | "double" | "triple" | "outer" | "bull";
  base: number;
  adjacent: Segment[];
};

export type SimulatedDart = {
  target: Segment;
  actual: Segment;
  score: number;
};

export type SimulatedVisit = {
  darts: SimulatedDart[];
  visitScore: number;
  bust: boolean;
  checkout: boolean;
};

export type ScoringOutcomes = Record<string, number>;

export type SetupOutcomes = {
  hit: number;
  neighborSingle?: number;
  neighborTreble?: number;
  wrongRing: number;
  neighborWrongRing: number;
  outside: number;
  other: number;
};

export type BullSetupOutcomes = {
  hit: number;
  wrongRing: number;
  outside: number;
  other: number;
};

export type DoubleOutcomes = {
  hit: number;
  inside: number;
  neighborSingle: number;
  neighborDouble: number;
  outside: number;
  other: number;
};

export type DeviationBand = { below: number; above: number };

export type StatRange = {
  min: number;
  max: number;
  deviation: { leg: DeviationBand; set: DeviationBand };
};

export type ConvergenceConfig = {
  maxScoringHitShift: number;
  maxSetupHitShift: number;
  maxCheckoutHitShift: number;
  distanceScale: number;
};

export type LevelProfile = {
  level: number;
  threeDartAverage: StatRange;
  scoringAverage: StatRange;
  checkoutPercentage: { min: number; max: number };
  scoring: { aim: "S20" | "T20"; outcomes: ScoringOutcomes };
  setup: {
    singles: SetupOutcomes;
    trebles: SetupOutcomes;
    outerBull: BullSetupOutcomes;
    bull: BullSetupOutcomes;
  };
  doubles: { outcomes: DoubleOutcomes };
  convergence: ConvergenceConfig;
};

export type SkillProfile = LevelProfile;

export type ConvergenceBias = {
  scoringHitShift: number;
  setupHitShift: number;
  checkoutHitShift: number;
};

export type SetRunningStats = {
  dartsThrown: number;
  scoringVisitCount: number;
  threeDartAverage: number;
  scoringAverage: number;
  checkoutPercentage: number;
  doubleAttempts: number;
  checkouts: number;
};

export function createEmptySetRunningStats(): SetRunningStats {
  return {
    dartsThrown: 0,
    scoringVisitCount: 0,
    threeDartAverage: 0,
    scoringAverage: 0,
    checkoutPercentage: 0,
    doubleAttempts: 0,
    checkouts: 0,
  };
}

export type MatchPlan = {
  legTargets: number[];
  skill: SkillProfile;
  seed: number;
};

export type SimulateVisitContext = {
  remaining: number;
  skill: SkillProfile;
  legTarget: number;
  dartsInVisit: number;
  setRunningStats: SetRunningStats;
};

export type { Rng } from "./rng";
export type { BotCheckoutRoute } from "./checkout/bot-checkout-route";
export type { ThrowIntent } from "./strategy-engine";
export type { MatchStats, StatsValidation } from "./statistics-engine";
