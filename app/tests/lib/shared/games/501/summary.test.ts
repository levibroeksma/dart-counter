import { describe, expect, it } from "vitest";
import { buildFiveOhOneSession, buildSummary } from "@lib/shared/games/501";

function buildMinimalCompletedSession(
  players: Parameters<typeof buildFiveOhOneSession>[0]["players"],
) {
  const session = buildFiveOhOneSession({
    matchMode: "first-to",
    targetCount: 1,
    unit: "legs",
    players,
  });
  session.state.status = "completed";
  session.state.phase = "summary";
  return session;
}

describe("buildSummary", () => {
  it("returns players array with one entry for 1-player match", () => {
    const session = buildMinimalCompletedSession([
      { id: "u1", type: "user", name: "Levi" },
    ]);
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 180,
        remainingBefore: 501,
        remainingAfter: 321,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 2,
        playerId: "u1",
        visitScore: 321,
        remainingBefore: 321,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        dartsOnDouble: 1,
        stateSnapshot: structuredClone(session.state),
      },
    ];
    session.state.players[0].totalLegsWon = 1;

    const summary = buildSummary(session);

    expect(summary.winnerDisplayName).toBe("Levi");
    expect(summary.showSetsRow).toBe(false);
    expect(summary.players).toHaveLength(1);
    expect(summary.players[0]).toMatchObject({
      playerId: "u1",
      displayName: "Levi",
      isBot: false,
      isGuest: false,
      isWinner: true,
      legsWon: 1,
      threeDartAverage: 250.5,
      checkoutsMade: 1,
      checkoutAttempts: 1,
      checkoutRate: 100,
      highestFinish: 321,
      highestScore: 321,
      bestLegDarts: 6,
      worstLegDarts: 6,
    });
  });

  it("returns null firstNineAverage when player has fewer than 3 visits", () => {
    const session = buildMinimalCompletedSession([
      { id: "u1", type: "user", name: "Levi" },
    ]);
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 180,
        remainingBefore: 501,
        remainingAfter: 321,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 2,
        playerId: "u1",
        visitScore: 321,
        remainingBefore: 321,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
    ];

    expect(buildSummary(session).players[0].firstNineAverage).toBeNull();
  });

  it("returns null checkoutRate when no double attempts", () => {
    const session = buildMinimalCompletedSession([
      { id: "u1", type: "user", name: "Levi" },
    ]);
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 501,
        remainingBefore: 501,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
    ];

    expect(buildSummary(session).players[0].checkoutRate).toBeNull();
  });

  it("returns null bestLegDarts and worstLegDarts when player won no legs", () => {
    const session = buildMinimalCompletedSession([
      { id: "u1", type: "user", name: "Levi" },
      { id: "g1", type: "guest", name: "Guest" },
    ]);
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "u1",
        visitScore: 60,
        remainingBefore: 501,
        remainingAfter: 441,
        bust: false,
        checkout: false,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
      {
        visitNumber: 2,
        playerId: "g1",
        visitScore: 141,
        remainingBefore: 501,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
    ];
    session.state.players[1].totalLegsWon = 1;

    const summary = buildSummary(session);

    expect(summary.players[0].bestLegDarts).toBeNull();
    expect(summary.players[0].worstLegDarts).toBeNull();
    expect(summary.players[1].bestLegDarts).toBe(3);
    expect(summary.players[1].worstLegDarts).toBe(3);
  });

  it("orders two-player summary as [user, opponent]", () => {
    const session = buildMinimalCompletedSession([
      { id: "u1", type: "user", name: "Levi" },
      { id: "b1", type: "dartbot", name: "DartBot", level: 5 },
    ]);
    session.visitHistory = [
      {
        visitNumber: 1,
        playerId: "b1",
        visitScore: 141,
        remainingBefore: 501,
        remainingAfter: 0,
        bust: false,
        checkout: true,
        legNumber: 1,
        setNumber: 1,
        dartsThrown: 3,
        stateSnapshot: structuredClone(session.state),
      },
    ];
    session.state.players[1].totalLegsWon = 1;

    const summary = buildSummary(session);

    expect(summary.players).toHaveLength(2);
    expect(summary.players[0].playerId).toBe("u1");
    expect(summary.players[1].playerId).toBe("b1");
    expect(summary.players[1].displayName).toBe("DartBot");
    expect(summary.players[1].isBot).toBe(true);
    expect(summary.winnerDisplayName).toBe("DartBot");
  });

  it("sets showSetsRow true when unit is sets", () => {
    const session = buildFiveOhOneSession({
      matchMode: "first-to",
      targetCount: 2,
      unit: "sets",
      players: [{ id: "u1", type: "user", name: "Levi" }],
    });
    session.state.status = "completed";
    session.state.phase = "summary";

    expect(buildSummary(session).showSetsRow).toBe(true);
  });
});
