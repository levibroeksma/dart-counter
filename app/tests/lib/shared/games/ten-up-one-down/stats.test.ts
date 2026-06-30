import { describe, it, expect } from "vitest";
import { applyGameCompletionToStats } from "@lib/shared/games/ten-up-one-down/stats";
import { createEmptyPlayerDartStats } from "@lib/shared/stats/double-stats";
import { buildTenUpOneDownSession } from "@lib/shared/games/ten-up-one-down/session-factory";
import { applyRoundToState } from "@lib/shared/games/ten-up-one-down/state";
import { buildRoundRecord } from "@lib/shared/games/ten-up-one-down/round";

describe("applyGameCompletionToStats", () => {
  it("applies all rounds from session to player dart stats", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 2 });
    const success = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    session.state = applyRoundToState(session.state, success, session.settings);
    session.roundHistory.push(success);

    const failure = buildRoundRecord(2, session.state.currentTarget, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 2,
    });
    session.state = applyRoundToState(session.state, failure, session.settings);
    session.roundHistory.push(failure);

    const stats = createEmptyPlayerDartStats();
    applyGameCompletionToStats(stats, session);

    expect(stats.doubleAttempts).toBe(3);
    expect(stats.doubleHits).toBe(1);
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.totalCheckoutDarts).toBe(2);
  });
});
