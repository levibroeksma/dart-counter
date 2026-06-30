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

export type LevelProfile = {
  level: number;
  threeDartAverage: { min: number; max: number };
  scoringAverage: { min: number; max: number };
  checkout: { average: number; successRate: number };
  execution: {
    hitAccuracy: number;
    missSpread: number;
    checkoutDiscipline: number;
    variance: number;
  };
};

export type SkillProfile = Omit<LevelProfile, "level"> & { level: number };

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
};
