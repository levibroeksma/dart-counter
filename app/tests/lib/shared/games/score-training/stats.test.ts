import { describe, it, expect } from "vitest";
import {
  createEmptyScoreTrainingStats,
  applyGameCompletionToStats,
} from "@lib/shared/games/score-training/stats";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";

const session: ScoreTrainingSession = {
  slug: "score-training",
  settings: { endMode: "rounds", roundCount: 10 },
  state: { currentRound: 3, currentScore: 165, status: "completed", lastScore: 45 },
  roundHistory: [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
    { roundNumber: 2, visitScore: 60, runningTotal: 120 },
    { roundNumber: 3, visitScore: 45, runningTotal: 165 },
  ],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("applyGameCompletionToStats", () => {
  it("updates lifetime aggregates and bests", () => {
    const stats = createEmptyScoreTrainingStats();
    applyGameCompletionToStats(stats, session);
    expect(stats).toEqual({
      gamesCompleted: 1,
      totalDartsThrown: 9,
      totalPointsScored: 165,
      bestVisitScore: 60,
      bestGameAverage: 55,
    });
  });

  it("updates bests only when exceeded", () => {
    const stats = {
      gamesCompleted: 1,
      totalDartsThrown: 9,
      totalPointsScored: 165,
      bestVisitScore: 100,
      bestGameAverage: 80,
    };
    applyGameCompletionToStats(stats, session);
    expect(stats.bestVisitScore).toBe(100);
    expect(stats.bestGameAverage).toBe(80);
    expect(stats.gamesCompleted).toBe(2);
  });
});
