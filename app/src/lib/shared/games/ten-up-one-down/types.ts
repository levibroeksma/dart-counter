export type TenUpOneDownSettings =
  | { endMode: "rounds"; roundCount: number }
  | { endMode: "timed"; playtimeSeconds: number };

export type TenUpOneDownGameStatus = "active" | "paused" | "completed";

export type TenUpOneDownGameState = {
  currentRound: number;
  currentTarget: number;
  status: TenUpOneDownGameStatus;
  lastAdjustment: "success" | "failure" | null;
};

export type TenUpOneDownRoundRecord = {
  roundNumber: number;
  targetAtStart: number;
  targetAfter: number;
  finished: boolean;
  dartsUsed: 1 | 2 | 3;
  dartsOnDouble: 0 | 1 | 2 | 3;
};

export type TenUpOneDownSession = {
  slug: "ten-up-one-down";
  settings: TenUpOneDownSettings;
  state: TenUpOneDownGameState;
  roundHistory: TenUpOneDownRoundRecord[];
  timeRemainingSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TenUpOneDownCompletionReason = "checkout170" | "rounds" | "timed";

export type TenUpOneDownSummary = {
  completionReason: TenUpOneDownCompletionReason;
  roundsPlayed: number;
  checkouts: number;
  doubleHitPercentage: number;
  finalTarget: number;
  peakTarget: number;
};
