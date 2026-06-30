import { describe, expect, it } from "vitest";
import {
  applyVisit,
  buildFiveOhOneSession,
  LEGS_PER_SET,
  revertLastOpponentPair,
  revertLastVisit,
  STARTING_SCORE,
} from "@lib/shared/games/501";

const onePlayerSettings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [{ id: "u1", type: "user" as const, name: "Levi" }],
};

const twoPlayerSettings = {
  matchMode: "first-to" as const,
  targetCount: 2,
  unit: "legs" as const,
  players: [
    { id: "u1", type: "user" as const, name: "Levi" },
    { id: "g1", type: "guest" as const, name: "Guest" },
  ],
};

describe("applyVisit", () => {
  it("applies visit when session state is a reactive proxy", () => {
    const session = buildFiveOhOneSession(onePlayerSettings);
    const proxiedSession = new Proxy(session, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (value && typeof value === "object") {
          return new Proxy(value, {});
        }
        return value;
      },
    });

    const next = applyVisit(proxiedSession, 60);

    expect(next.visitHistory).toHaveLength(1);
    expect(next.state.players[0]!.remaining).toBe(441);
  });

  it("updates score and darts on non-bust visit", () => {
    const session = buildFiveOhOneSession(onePlayerSettings);
    session.updatedAt = "2020-01-01T00:00:00.000Z";

    const next = applyVisit(session, 60);

    expect(next.state.players[0]!.remaining).toBe(441);
    expect(next.state.players[0]!.dartsThisLeg).toBe(3);
    expect(next.state.players[0]!.lastVisitScore).toBe(60);
    expect(next.state.currentPlayerId).toBe("u1");
    expect(next.visitHistory).toHaveLength(1);
    expect(next.updatedAt).not.toBe(session.updatedAt);
  });

  it("keeps score and passes turn on bust in 2P", () => {
    const session = buildFiveOhOneSession(twoPlayerSettings, "u1");
    session.state.players[0]!.remaining = 10;

    const next = applyVisit(session, 12);

    expect(next.state.currentPlayerId).toBe("g1");
    expect(next.state.players[0]!.remaining).toBe(10);
    expect(next.state.players[0]!.dartsThisLeg).toBe(3);
    expect(next.state.players[0]!.lastVisitScore).toBeNull();
    expect(next.visitHistory[0]).toMatchObject({
      playerId: "u1",
      bust: true,
      checkout: false,
      remainingBefore: 10,
      remainingAfter: 10,
    });
  });

  it("completes match on winning checkout", () => {
    const session = buildFiveOhOneSession(onePlayerSettings);
    session.state.players[0]!.remaining = 40;

    const next = applyVisit(session, 40);
    const player = next.state.players[0]!;

    expect(next.state.status).toBe("completed");
    expect(next.state.phase).toBe("summary");
    expect(player.totalLegsWon).toBe(1);
    expect(player.legsWonInSet).toBe(1);
  });

  it("records dartsThrown=3 on bust visit", () => {
    let session = buildFiveOhOneSession(onePlayerSettings);
    session.state.players[0]!.remaining = 32;

    session = applyVisit(session, 31);

    expect(session.visitHistory[0]!.bust).toBe(true);
    expect(session.visitHistory[0]!.dartsThrown).toBe(3);
    expect(session.state.players[0]!.dartsThisLeg).toBe(3);
  });

  it("uses dartsForFinish as dartsThrown on checkout", () => {
    let session = buildFiveOhOneSession(onePlayerSettings);
    session.state.players[0]!.remaining = 40;

    session = applyVisit(session, 40, {
      dartsThrown: 2,
      dartsForFinish: 2,
      dartsOnDouble: 1,
    });

    expect(session.visitHistory[0]!.dartsThrown).toBe(2);
    expect(session.visitHistory[0]!.dartsForFinish).toBe(2);
    expect(session.visitHistory[0]!.dartsOnDouble).toBe(1);
    expect(session.state.players[0]!.dartsThisLeg).toBe(2);
  });

  it("stores botRngBefore on visit record when provided", () => {
    const session = buildFiveOhOneSession(twoPlayerSettings, "u1");

    const next = applyVisit(session, 60, { botRngBefore: 12345 });

    expect(next.visitHistory).toHaveLength(1);
    expect(next.visitHistory[0]!.botRngBefore).toBe(12345);
  });

  it("increments bot leg index after checkout", () => {
    const session = buildFiveOhOneSession(
      {
        matchMode: "first-to",
        targetCount: 2,
        unit: "legs",
        players: [
          { id: "u1", type: "user", name: "Levi" },
          { id: "b1", type: "dartbot", name: "DartBot", level: 10 },
        ],
      },
      "b1",
    );
    session.state.phase = "play";
    session.state.currentPlayerId = "b1";
    session.state.players[1]!.remaining = 40;
    session.botState!.currentLegIndex = 0;

    const next = applyVisit(session, 40);

    expect(next.botState!.currentLegIndex).toBe(1);
  });

  it("starts new set after winning deciding leg in a set", () => {
    const session = buildFiveOhOneSession(
      {
        ...twoPlayerSettings,
        unit: "sets",
        targetCount: 2,
      },
      "u1",
    );

    session.state.currentLeg = LEGS_PER_SET;
    session.state.currentSet = 1;
    session.state.players[0]!.remaining = 40;
    session.state.players[0]!.legsWonInSet = LEGS_PER_SET - 1;
    session.state.legStartingPlayerId = "u1";
    session.state.currentPlayerId = "u1";

    const next = applyVisit(session, 40);
    const winner = next.state.players[0]!;
    const opponent = next.state.players[1]!;

    expect(next.state.status).toBe("active");
    expect(next.state.phase).toBe("play");
    expect(next.state.currentSet).toBe(2);
    expect(next.state.currentLeg).toBe(1);
    expect(next.state.legStartingPlayerId).toBe("g1");
    expect(next.state.currentPlayerId).toBe("g1");
    expect(winner.setsWon).toBe(1);
    expect(winner.legsWonInSet).toBe(0);
    expect(opponent.legsWonInSet).toBe(0);
    expect(winner.remaining).toBe(STARTING_SCORE);
    expect(opponent.remaining).toBe(STARTING_SCORE);
  });
});

describe("revertLastVisit", () => {
  it("restores full previous state across checkout leg transition", () => {
    const session = buildFiveOhOneSession(twoPlayerSettings, "u1");
    session.state.currentLeg = 1;
    session.state.currentSet = 1;
    session.state.players[0]!.remaining = 40;
    session.state.players[0]!.dartsThisLeg = 12;
    session.state.players[0]!.lastVisitScore = 60;
    session.state.currentPlayerId = "u1";
    session.state.legStartingPlayerId = "u1";

    const afterCheckout = applyVisit(session, 40);
    const reverted = revertLastVisit(afterCheckout);

    expect(reverted.state).toEqual(session.state);
    expect(reverted.visitHistory).toHaveLength(0);
  });
});

describe("revertLastOpponentPair", () => {
  it("reverts user then dartbot visits and rewinds bot rng", () => {
    const session = buildFiveOhOneSession(
      {
        matchMode: "first-to",
        targetCount: 1,
        unit: "legs",
        players: [
          { id: "u1", type: "user", name: "Levi" },
          { id: "b1", type: "dartbot", name: "DartBot", level: 10 },
        ],
      },
      "u1",
    );
    session.state.phase = "play";
    session.state.currentPlayerId = "u1";

    const userBefore = session.botState!.rngState;
    const afterUser = applyVisit(session, 60, { botRngBefore: userBefore });
    const afterBot = applyVisit(afterUser, 45);
    afterBot.botState!.rngState = userBefore + 99;

    const reverted = revertLastOpponentPair(afterBot);

    expect(reverted.state).toEqual(session.state);
    expect(reverted.visitHistory).toHaveLength(0);
    expect(reverted.botState!.rngState).toBe(userBefore);
  });

  it("does nothing when the last two visits are not user then dartbot", () => {
    const session = buildFiveOhOneSession(twoPlayerSettings, "u1");
    const afterUser = applyVisit(session, 60);
    const afterGuest = applyVisit(afterUser, 45);

    const reverted = revertLastOpponentPair(afterGuest);

    expect(reverted).toEqual(afterGuest);
  });
});
