export type ScoreTrainingSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };

export type ScoreTrainingGameStatus = "active" | "paused" | "completed";

export type ScoreTrainingGameState = {
  currentRound: number;
  currentScore: number;
  status: ScoreTrainingGameStatus;
  lastScore: number | null;
};

export type ScoreTrainingRoundRecord = {
  roundNumber: number;
  visitScore: number;
  runningTotal: number;
};

export type ScoreTrainingSession = {
  slug: "score-training";
  settings: ScoreTrainingSettings;
  state: ScoreTrainingGameState;
  roundHistory: ScoreTrainingRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ScoreTrainingSummary = {
  totalScore: number;
  threeDartAverage: number;
  roundsPlayed: number;
  dartsThrown: number;
};
