import { createInitialGameState } from "./state";
import type { SinglesTrainingSession, SinglesTrainingSettings } from "./types";
import { buildTargetSequence } from "./target-sequence";

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
