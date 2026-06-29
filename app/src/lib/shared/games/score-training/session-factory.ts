import { createInitialGameState } from "@lib/shared/games/score-training/state";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";
import type { ScoreTrainingSettings } from "@lib/shared/games/score-training/settings";

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
