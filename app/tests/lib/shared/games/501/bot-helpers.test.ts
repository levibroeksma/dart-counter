import { describe, expect, it } from "vitest";
import { buildFiveOhOneSession } from "@lib/shared/games/501/session-factory";
import {
  canUndoDartBotPair,
  getOpponentPlayer,
  isDartBotSession,
  isDartBotTurn,
  lastTwoVisitsAreUserThenDartBot,
} from "@lib/shared/games/501/bot-helpers";
import { applyVisit } from "@lib/shared/games/501/state";

const botSettings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [
    { id: "u1", type: "user" as const, name: "Levi" },
    { id: "b1", type: "dartbot" as const, name: "DartBot" as const, level: 10 },
  ],
};

const guestSettings = {
  matchMode: "first-to" as const,
  targetCount: 1,
  unit: "legs" as const,
  players: [
    { id: "u1", type: "user" as const, name: "Levi" },
    { id: "g1", type: "guest" as const, name: "Guest" },
  ],
};

describe("bot-helpers", () => {
  it("returns opponent player in two player session", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");

    const opponent = getOpponentPlayer(session, "u1");

    expect(opponent?.id).toBe("b1");
  });

  it("detects dartbot sessions", () => {
    const botSession = buildFiveOhOneSession(botSettings, "u1");
    const guestSession = buildFiveOhOneSession(guestSettings, "u1");

    expect(isDartBotSession(botSession)).toBe(true);
    expect(isDartBotSession(guestSession)).toBe(false);
  });

  it("detects dartbot turn from current player", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    session.state.currentPlayerId = "b1";

    expect(isDartBotTurn(session)).toBe(true);
  });

  it("detects last two visits as user then dartbot", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    const afterUser = applyVisit(session, 60);
    const afterBot = applyVisit(afterUser, 45);

    expect(lastTwoVisitsAreUserThenDartBot(afterBot)).toBe(true);
  });

  it("allows undo only when user turn follows a user+dartbot pair", () => {
    const session = buildFiveOhOneSession(botSettings, "u1");
    session.state.phase = "play";
    const afterUser = applyVisit(session, 60, { botRngBefore: 99 });
    const afterBot = applyVisit(afterUser, 45);

    expect(canUndoDartBotPair(afterBot)).toBe(true);
    expect(canUndoDartBotPair(afterUser)).toBe(false);
  });
});
