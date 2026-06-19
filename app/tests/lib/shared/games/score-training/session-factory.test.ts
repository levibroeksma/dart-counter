import { describe, it, expect } from "vitest";
import { buildScoreTrainingSession } from "@lib/shared/games/score-training/session-factory";
import { STARTING_SCORE } from "@lib/shared/games/score-training/constants";

describe("buildScoreTrainingSession", () => {
  it("creates an active rounds session with empty history", () => {
    const session = buildScoreTrainingSession({
      endMode: "rounds",
      roundCount: 10,
    });

    expect(session.slug).toBe("score-training");
    expect(session.settings).toEqual({ endMode: "rounds", roundCount: 10 });
    expect(session.state).toEqual({
      currentRound: 1,
      currentScore: STARTING_SCORE,
      status: "active",
      lastScore: null,
    });
    expect(session.roundHistory).toEqual([]);
    expect(session.timeRemainingSeconds).toBeNull();
    expect(session.createdAt).toMatch(/^\d{4}-/);
    expect(session.updatedAt).toMatch(/^\d{4}-/);
  });

  it("sets timeRemainingSeconds for timed mode", () => {
    const session = buildScoreTrainingSession({
      endMode: "timed",
      playtimeSeconds: 600,
    });

    expect(session.timeRemainingSeconds).toBe(600);
  });
});
