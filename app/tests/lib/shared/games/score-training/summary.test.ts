import { describe, it, expect } from "vitest";
import { buildSummary } from "@lib/shared/games/score-training/summary";
import type { ScoreTrainingSession } from "@lib/shared/games/score-training/session";

const baseSession: ScoreTrainingSession = {
  slug: "score-training",
  settings: { endMode: "rounds", roundCount: 10 },
  state: { currentRound: 4, currentScore: 165, status: "completed", lastScore: 45 },
  roundHistory: [
    { roundNumber: 1, visitScore: 60, runningTotal: 60 },
    { roundNumber: 2, visitScore: 60, runningTotal: 120 },
    { roundNumber: 3, visitScore: 45, runningTotal: 165 },
  ],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("buildSummary", () => {
  it("computes summary from session", () => {
    expect(buildSummary(baseSession)).toEqual({
      totalScore: 165,
      threeDartAverage: 55,
      roundsPlayed: 3,
      dartsThrown: 9,
    });
  });

  it("handles zero rounds", () => {
    const empty = {
      ...baseSession,
      state: { ...baseSession.state, currentScore: 0 },
      roundHistory: [],
    };
    expect(buildSummary(empty)).toEqual({
      totalScore: 0,
      threeDartAverage: 0,
      roundsPlayed: 0,
      dartsThrown: 0,
    });
  });
});
