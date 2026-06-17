export type SinglesTrainingDirection = "low-to-high" | "high-to-low" | "random";
export type SinglesTrainingMode = "normal" | "hard" | "extreme";
export type SinglesTrainingScoring = "traditional" | "uniform";

export type SinglesTrainingSettings = {
  direction: SinglesTrainingDirection;
  mode: SinglesTrainingMode;
  scoring: SinglesTrainingScoring;
};
