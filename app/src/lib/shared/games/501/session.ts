import type { FiveOhOneSettings } from "@lib/shared/games/501/settings";

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
};

export type FiveOhOneSession = {
  slug: "501";
  settings: FiveOhOneSettings;
  state: FiveOhOneGameState;
  visitHistory: FiveOhOneVisitRecord[];
  createdAt: string;
  updatedAt: string;
};

export function isFiveOhOneSession(value: unknown): value is FiveOhOneSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.slug === "501" &&
    Array.isArray(record.visitHistory) &&
    record.settings !== null &&
    typeof record.settings === "object" &&
    record.state !== null &&
    typeof record.state === "object"
  );
}
