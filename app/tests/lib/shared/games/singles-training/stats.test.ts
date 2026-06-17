import { describe, it, expect } from "vitest";
import {
  createEmptySinglesTrainingStats,
  applyGameCompletionToStats,
} from "@lib/shared/games/singles-training/stats";
import { createInitialGameState } from "@lib/shared/games/singles-training/state";
import type { SinglesTrainingSession } from "@lib/shared/games/singles-training/session";

describe("applyGameCompletionToStats", () => {
  it("increments gamesFailed on dead session", () => {
    const stats = createEmptySinglesTrainingStats();
    const session: SinglesTrainingSession = {
      slug: "singles-training" as const,
      settings: {
        direction: "low-to-high" as const,
        mode: "hard" as const,
        scoring: "traditional" as const,
      },
      targetSequence: [10],
      state: { ...createInitialGameState(), status: "dead" as const },
      dartHistory: [
        { targetIndex: 0, dartInVisit: 0, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 0, dartInVisit: 1, outcome: { type: "miss" as const }, points: 0 },
        { targetIndex: 0, dartInVisit: 2, outcome: { type: "miss" as const }, points: 0 },
      ],
      createdAt: "",
      updatedAt: "",
    };
    applyGameCompletionToStats(stats, session);
    expect(stats.gamesFailed).toBe(1);
    expect(stats.gamesCompleted).toBe(0);
  });
});
