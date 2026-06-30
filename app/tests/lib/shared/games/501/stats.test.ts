import { describe, expect, it } from "vitest";
import {
  applyGameCompletionToStats,
  applyVisit,
  buildFiveOhOneSession,
  createEmpty501Stats,
} from "@lib/shared/games/501";

function buildCompletedSinglePlayerSession() {
  let session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [{ id: "u1", type: "user", name: "Levi" }],
  });

  for (const score of [180, 180, 141]) {
    session = applyVisit(session, score);
  }

  return session;
}

function buildCompletedTwoPlayerSession(userWins: boolean) {
  let session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players: [
      { id: "u1", type: "user", name: "Levi" },
      { id: "g1", type: "guest", name: "Guest" },
    ],
  });

  session.state.phase = "play";
  session.state.currentPlayerId = userWins ? "u1" : "g1";
  session.state.legStartingPlayerId = userWins ? "u1" : "g1";

  const visits = userWins
    ? [180, 60, 180, 60, 141]
    : [60, 180, 60, 180, 141];

  for (const score of visits) {
    session = applyVisit(session, score);
  }

  return session;
}

describe("applyGameCompletionToStats", () => {
  it("increments only gamesCompleted for single-player completion", () => {
    const session = buildCompletedSinglePlayerSession();
    const stats = createEmpty501Stats();

    applyGameCompletionToStats(stats, session);

    expect(stats.gamesCompleted).toBe(1);
    expect(stats.gamesWon).toBe(0);
    expect(stats.totalDartsThrown).toBe(9);
    expect(stats.totalCheckouts).toBe(1);
    expect(stats.bestMatchAverage).toBe(167);
    expect(stats.bestLegAverage).toBe(167);
  });

  it("increments gamesCompleted and gamesWon when user wins 2-player game", () => {
    const session = buildCompletedTwoPlayerSession(true);
    const stats = createEmpty501Stats();

    applyGameCompletionToStats(stats, session);

    expect(stats.gamesCompleted).toBe(1);
    expect(stats.gamesWon).toBe(1);
    expect(stats.totalDartsThrown).toBe(9);
    expect(stats.totalCheckouts).toBe(1);
  });

  it("does not increment gamesWon when user loses 2-player game", () => {
    const session = buildCompletedTwoPlayerSession(false);
    const stats = createEmpty501Stats();

    applyGameCompletionToStats(stats, session);

    expect(stats.gamesCompleted).toBe(1);
    expect(stats.gamesWon).toBe(0);
  });
});
