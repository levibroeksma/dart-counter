import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";
import type { ScoreTrainingRoundRecord } from "@lib/shared/games/score-training/round";

export type ScoreTrainingGameStatus = "active" | "paused" | "completed";

export type ScoreTrainingGameState = {
  currentRound: number;
  currentScore: number;
  status: ScoreTrainingGameStatus;
  lastScore: number | null;
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

/**
 * Runtime guard for blob-loaded session documents (rejects legacy config blobs).
 */
export function isScoreTrainingSession(value: unknown): value is ScoreTrainingSession {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  const state = record.state;

  return (
    record.slug === "score-training" &&
    state !== null &&
    typeof state === "object" &&
    typeof (state as ScoreTrainingGameState).currentScore === "number" &&
    Array.isArray(record.roundHistory) &&
    record.settings !== null &&
    typeof record.settings === "object"
  );
}
