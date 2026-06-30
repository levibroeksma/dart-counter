export type SinglesTrainingDirection = "low-to-high" | "high-to-low" | "random";
export type SinglesTrainingMode = "normal" | "hard" | "extreme";
export type SinglesTrainingScoring = "traditional" | "uniform";

export type SinglesTrainingSettings = {
  direction: SinglesTrainingDirection;
  mode: SinglesTrainingMode;
  scoring: SinglesTrainingScoring;
};

export type SinglesTrainingTarget = number | "bull";
export type SinglesTrainingGameStatus = "active" | "dead" | "completed";

export type SegmentCounts = {
  miss: number;
  single: number;
  double: number;
  triple: number;
};

export type SinglesTrainingGameState = {
  status: SinglesTrainingGameStatus;
  currentTargetIndex: number;
  currentDartInVisit: 0 | 1 | 2;
  score: number;
  segmentCounts: SegmentCounts;
};

export type DartOutcomeType = "miss" | "single" | "double" | "triple";
export type DartOutcome = { type: DartOutcomeType };

export type DartRecord = {
  targetIndex: number;
  dartInVisit: 0 | 1 | 2;
  outcome: DartOutcome;
  points: number;
};

export type SinglesTrainingSession = {
  slug: "singles-training";
  settings: SinglesTrainingSettings;
  targetSequence: SinglesTrainingTarget[];
  state: SinglesTrainingGameState;
  dartHistory: DartRecord[];
  createdAt: string;
  updatedAt: string;
};

export type SinglesTrainingSummary = {
  status: "completed" | "dead";
  score: number;
  segmentCounts: SegmentCounts;
  hitRatio: number;
  dartPositionSuccessRates: [number, number, number];
  targetsCompleted: number;
  dartsThrown: number;
};
