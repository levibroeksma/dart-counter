import type { ScoreTrainingGameState, ScoreTrainingSession } from "./types";

export type {
  ScoreTrainingGameState,
  ScoreTrainingGameStatus,
  ScoreTrainingSession,
} from "./types";

/**
 * Runtime guard for persisted session documents (rejects legacy config-only shapes).
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
