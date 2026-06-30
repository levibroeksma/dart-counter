import { describe, it, expect } from "vitest";
import { isScoreTrainingSession } from "@lib/shared/games/score-training";

const validSession = {
  slug: "score-training",
  settings: { endMode: "rounds", roundCount: 10 },
  state: { currentRound: 1, currentScore: 0, status: "active", lastScore: null },
  roundHistory: [],
  timeRemainingSeconds: null,
  createdAt: "",
  updatedAt: "",
};

describe("isScoreTrainingSession", () => {
  it("accepts valid session", () => {
    expect(isScoreTrainingSession(validSession)).toBe(true);
  });

  it("rejects wrong slug", () => {
    expect(isScoreTrainingSession({ ...validSession, slug: "501" })).toBe(false);
  });
});
