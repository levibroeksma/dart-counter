import { describe, it, expect } from "vitest";
import {
  applyRoundToState,
  buildRoundRecord,
  buildScoreTrainingSession,
  validateCompletedScoreTrainingSession,
} from "@lib/shared/games/score-training";
import { MessageCode } from "@lib/shared/constants/errors.constants";

describe("validateCompletedScoreTrainingSession", () => {
  it("accepts a legitimately completed rounds session", () => {
    const session = buildScoreTrainingSession({ endMode: "rounds", roundCount: 2 });
    for (let i = 0; i < 2; i++) {
      const round = buildRoundRecord(session.state.currentRound, 60, session.state.currentScore);
      session.state = applyRoundToState(session.state, round, session.settings);
      session.roundHistory.push(round);
    }
    const result = validateCompletedScoreTrainingSession(session);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.state.status).toBe("completed");
  });

  it("rejects incomplete session", () => {
    const session = buildScoreTrainingSession({ endMode: "rounds", roundCount: 10 });
    const result = validateCompletedScoreTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.GAME_NOT_COMPLETE });
  });

  it("rejects tampered running totals", () => {
    const session = buildScoreTrainingSession({ endMode: "rounds", roundCount: 1 });
    const round = buildRoundRecord(1, 60, session.state.currentScore);
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push({ ...round, runningTotal: 999 });
    const result = validateCompletedScoreTrainingSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_ROUND });
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedScoreTrainingSession({ slug: "501" });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
