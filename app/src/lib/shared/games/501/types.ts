import type { MatchPlan, SetRunningStats } from "@lib/shared/dartbot";

export type FiveOhOneUserOrGuestPlayer = {
  id: string;
  type: "user" | "guest";
  name: string;
};

export type FiveOhOneDartbotPlayer = {
  id: string;
  type: "dartbot";
  name: "DartBot";
  level: number;
};

export type FiveOhOnePlayer =
  | FiveOhOneUserOrGuestPlayer
  | FiveOhOneDartbotPlayer;

export type FiveOhOneMatchMode = "best-of" | "first-to";
export type FiveOhOneUnit = "legs" | "sets";

export type FiveOhOneSettings = {
  matchMode: FiveOhOneMatchMode;
  targetCount: number;
  unit: FiveOhOneUnit;
  players: FiveOhOnePlayer[];
};

export type FiveOhOneGameStatus = "active" | "completed";
export type FiveOhOnePhase = "starter" | "play" | "summary";

export type FiveOhOnePlayerState = {
  playerId: string;
  remaining: number;
  dartsThisLeg: number;
  lastVisitScore: number | null;
  legsWonInSet: number;
  setsWon: number;
  totalLegsWon: number;
};

export type FiveOhOneGameState = {
  status: FiveOhOneGameStatus;
  phase: FiveOhOnePhase;
  currentPlayerId: string;
  currentLeg: number;
  currentSet: number;
  players: FiveOhOnePlayerState[];
  scoreAtVisitStart: number;
  legStartingPlayerId: string;
};

export type FiveOhOneBotState = {
  matchPlan: MatchPlan;
  rngState: number;
  currentLegIndex: number;
  setRunningStats: SetRunningStats;
  setNumber: number;
};

export type FiveOhOneVisitRecord = {
  visitNumber: number;
  playerId: string;
  visitScore: number;
  remainingBefore: number;
  remainingAfter: number;
  bust: boolean;
  checkout: boolean;
  legNumber: number;
  setNumber: number;
  stateSnapshot: FiveOhOneGameState;
  botRngBefore?: number;
  dartsThrown: number;
  dartsOnDouble?: number;
  dartsForFinish?: number;
};

export type FiveOhOneSession = {
  slug: "501";
  settings: FiveOhOneSettings;
  state: FiveOhOneGameState;
  visitHistory: FiveOhOneVisitRecord[];
  createdAt: string;
  updatedAt: string;
  botState?: FiveOhOneBotState;
};

export type FiveOhOnePlayerSummary = {
  playerId: string;
  displayName: string;
  isBot: boolean;
  isGuest: boolean;
  isWinner: boolean;
  setsWon: number;
  legsWon: number;
  threeDartAverage: number;
  firstNineAverage: number | null;
  checkoutRate: number | null;
  checkoutsMade: number;
  checkoutAttempts: number;
  highestFinish: number | null;
  highestScore: number | null;
  bestLegDarts: number | null;
  worstLegDarts: number | null;
};

export type FiveOhOneSummary = {
  winnerDisplayName: string;
  showSetsRow: boolean;
  players: FiveOhOnePlayerSummary[];
};

export type Player501Stats = {
  gamesCompleted: number;
  gamesWon: number;
  totalDartsThrown: number;
  totalCheckouts: number;
  bestLegAverage: number;
  bestMatchAverage: number;
};

export type VisitClassification = {
  bust: boolean;
  checkout: boolean;
  remainingAfter: number;
};
