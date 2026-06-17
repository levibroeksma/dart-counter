import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  applyRoundToState,
  revertRoundFromState,
  isGameComplete,
} from "@lib/shared/games/score-training/state";
import { buildRoundRecord } from "@lib/shared/games/score-training/round";

describe("createInitialGameState", () => {
  it("starts at round 1, score 0", () => {
    expect(createInitialGameState({ endMode: "rounds", roundCount: 10 })).toEqual({
      currentRound: 1,
      currentScore: 0,
      status: "active",
      lastScore: null,
    });
  });
});

describe("applyRoundToState", () => {
  it("updates score and increments round", () => {
    const state = createInitialGameState({ endMode: "rounds", roundCount: 10 });
    const round = buildRoundRecord(1, 60, 0);
    const updated = applyRoundToState(state, round, { endMode: "rounds", roundCount: 10 });
    expect(updated.currentScore).toBe(60);
    expect(updated.lastScore).toBe(60);
    expect(updated.currentRound).toBe(2);
    expect(updated.status).toBe("active");
  });

  it("completes after final round in rounds mode", () => {
    const state = {
      currentRound: 10,
      currentScore: 400,
      status: "active" as const,
      lastScore: 40,
    };
    const round = buildRoundRecord(10, 45, 400);
    const updated = applyRoundToState(state, round, { endMode: "rounds", roundCount: 10 });
    expect(updated.status).toBe("completed");
  });

  it("completes timed mode when timer expired", () => {
    const state = createInitialGameState({ endMode: "timed", playtimeSeconds: 600 });
    const round = buildRoundRecord(1, 60, 0);
    const updated = applyRoundToState(state, round, { endMode: "timed", playtimeSeconds: 600 }, true);
    expect(updated.status).toBe("completed");
  });
});

describe("revertRoundFromState", () => {
  it("restores score and round after undo", () => {
    const state = {
      currentRound: 3,
      currentScore: 105,
      status: "active" as const,
      lastScore: 45,
    };
    const removedRound = buildRoundRecord(2, 45, 60);
    const reverted = revertRoundFromState(state, removedRound, 60);
    expect(reverted.currentRound).toBe(2);
    expect(reverted.currentScore).toBe(60);
    expect(reverted.lastScore).toBe(60);
    expect(reverted.status).toBe("active");
  });

  it("reactivates completed game on undo", () => {
    const state = {
      currentRound: 11,
      currentScore: 445,
      status: "completed" as const,
      lastScore: 45,
    };
    const removedRound = buildRoundRecord(10, 45, 400);
    const reverted = revertRoundFromState(state, removedRound, 40);
    expect(reverted.status).toBe("active");
  });
});

describe("isGameComplete", () => {
  it("completes rounds mode when round exceeds count", () => {
    expect(
      isGameComplete(
        { currentRound: 11, currentScore: 0, status: "active", lastScore: null },
        { endMode: "rounds", roundCount: 10 },
        false,
      ),
    ).toBe(true);
  });

  it("completes timed mode on timerExpired", () => {
    expect(
      isGameComplete(
        { currentRound: 3, currentScore: 100, status: "active", lastScore: 30 },
        { endMode: "timed", playtimeSeconds: 600 },
        true,
      ),
    ).toBe(true);
  });

  it("returns false for active game within limits", () => {
    expect(
      isGameComplete(
        { currentRound: 5, currentScore: 200, status: "active", lastScore: 40 },
        { endMode: "rounds", roundCount: 10 },
        false,
      ),
    ).toBe(false);
  });
});
