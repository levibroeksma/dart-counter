import { describe, it, expect } from "vitest";
import {
  applyRoundToState,
  buildRoundRecord,
  buildSummary,
  buildTenUpOneDownSession,
  MAX_TARGET,
} from "@lib/shared/games/ten-up-one-down";

describe("buildSummary", () => {
  it("computes session aggregates and peak target across progression", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    const round = buildRoundRecord(1, 41, {
      outcome: "success",
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    const summary = buildSummary(session);
    expect(summary.roundsPlayed).toBe(1);
    expect(summary.checkouts).toBe(1);
    expect(summary.doubleHitPercentage).toBeCloseTo(100);
    expect(summary.finalTarget).toBe(51);
    expect(summary.peakTarget).toBe(51);
    expect(summary.completionReason).toBe("rounds");
  });

  it("uses checkout170 completion reason when finishing at max target", () => {
    const session = buildTenUpOneDownSession({ endMode: "rounds", roundCount: 10 });
    const round = buildRoundRecord(1, MAX_TARGET, {
      outcome: "success",
      dartsForFinish: 3,
      dartsOnDouble: 1,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    const summary = buildSummary(session);
    expect(summary.completionReason).toBe("checkout170");
    expect(summary.peakTarget).toBe(MAX_TARGET);
  });

  it("uses timed completion reason for timed sessions", () => {
    const session = buildTenUpOneDownSession({
      endMode: "timed",
      playtimeSeconds: 60,
    });
    session.timeRemainingSeconds = 0;
    session.state.status = "completed";
    const round = buildRoundRecord(1, 41, {
      outcome: "failure",
      dartsUsed: 3,
      dartsOnDouble: 0,
    });
    session.state = applyRoundToState(session.state, round, session.settings);
    session.roundHistory.push(round);

    const summary = buildSummary(session);
    expect(summary.completionReason).toBe("timed");
  });
});
