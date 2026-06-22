import { createInitialGameState } from "@lib/shared/games/singles-training/state";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";
import type { SinglesTrainingSettings } from "@lib/shared/games/singles-training/settings";
import { buildTargetSequence } from "@lib/shared/games/singles-training/target-sequence";

/**
 * Builds an in-memory singles-training session from validated settings.
 */
export function buildSinglesTrainingSession(
  settings: SinglesTrainingSettings,
  random: () => number = Math.random,
): SinglesTrainingSession {
  const now = new Date().toISOString();

  return {
    slug: "singles-training",
    settings,
    targetSequence: buildTargetSequence(settings.direction, random),
    state: createInitialGameState(),
    dartHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}
