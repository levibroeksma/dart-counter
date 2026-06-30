import { describe, it, expect } from "vitest";
import { validateCompletedTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/completion";
import { MessageCode } from "@lib/shared/constants/errors.constants";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

function buildCompletedRoundsSession(roundCount = 2) {
  const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount });
  for (let i = 0; i < roundCount; i++) {
    const round = buildRoundRecord(session.state.currentRound, session.state.currentTarget, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 0,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);
  }
  return session;
}

describe("validateCompletedTenUpOneDownSession", () => {
  it("accepts a legitimately completed rounds session", () => {
    const session = buildCompletedRoundsSession(2);
    const result = validateCompletedTenUpOneDownSession(session);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.state.status).toBe("completed");
  });

  it("rejects incomplete session", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    const result = validateCompletedTenUpOneDownSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.GAME_NOT_COMPLETE });
  });

  it("rejects tampered targetAfter", () => {
    const session = buildCompletedRoundsSession(1);
    session.roundHistory[0] = { ...session.roundHistory[0]!, targetAfter: 999 };
    const result = validateCompletedTenUpOneDownSession(session);
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_ROUND });
  });

  it("rejects invalid shape", () => {
    const result = validateCompletedTenUpOneDownSession({ slug: "501" });
    expect(result).toEqual({ valid: false, code: MessageCode.INVALID_GAME_SETTINGS });
  });
});
