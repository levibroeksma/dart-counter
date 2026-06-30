import { describe, it, expect } from "vitest";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down";
import { createInitialGameState } from "@lib/shared/games/ten-up-one-down/state";
import type { TenUpOneDownRoundRecord } from "@lib/shared/games/ten-up-one-down";

const successRound: TenUpOneDownRoundRecord = {
  roundNumber: 1, targetAtStart: 41, targetAfter: 51,
  finished: true, dartsUsed: 2, dartsOnDouble: 1,
};

describe("createInitialGameState", () => {
  it("initializes rounds mode", () => {
    const state = createInitialGameState({ endMode: "rounds", roundCount: 10 });
    expect(state).toEqual({
      currentRound: 1, currentTarget: 41, status: "active", lastAdjustment: null,
    });
  });
});

describe("applyRoundToState", () => {
  it("updates target and increments round on success", () => {
    const state = createInitialGameState({ endMode: "rounds", roundCount: 10 });
    const updated = applyRoundToState(state, successRound, { endMode: "rounds", roundCount: 10 });
    expect(updated.currentTarget).toBe(51);
    expect(updated.currentRound).toBe(2);
    expect(updated.lastAdjustment).toBe("success");
    expect(updated.status).toBe("active");
  });

  it("completes when round count exceeded", () => {
    const state = { currentRound: 10, currentTarget: 41, status: "active" as const, lastAdjustment: null };
    const updated = applyRoundToState(state, successRound, { endMode: "rounds", roundCount: 10 });
    expect(updated.status).toBe("completed");
  });

  it("completes on checkout at 170", () => {
    const state = { currentRound: 5, currentTarget: 170, status: "active" as const, lastAdjustment: null };
    const round = { ...successRound, targetAtStart: 170, targetAfter: 170 };
    const updated = applyRoundToState(state, round, { endMode: "rounds", roundCount: 10 });
    expect(updated.status).toBe("completed");
  });
});
