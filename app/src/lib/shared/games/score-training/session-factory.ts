import { createInitialGameState } from "./state";
import type { ScoreTrainingSession, ScoreTrainingSettings } from "./types";

/**
 * Builds an in-memory score-training session from validated settings.
 */
export function buildScoreTrainingSession(
  settings: ScoreTrainingSettings,
): ScoreTrainingSession {
  const now = new Date().toISOString();

  return {
    slug: "score-training",
    settings,
    state: createInitialGameState(settings),
    roundHistory: [],
    timeRemainingSeconds:
      settings.endMode === "timed" ? settings.playtimeSeconds : null,
    createdAt: now,
    updatedAt: now,
  };
}
